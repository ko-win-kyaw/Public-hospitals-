// --- ၀။ Firebase Initialization ---
const firebaseConfig = {
    apiKey: "AIzaSyD4Yiez3VXKD90za0wnt03lFPjeln4su7U",
    authDomain: "hospital-app-caf85.firebaseapp.com",
    projectId: "hospital-app-caf85",
    storageBucket: "hospital-app-caf85.firebasestorage.app",
    messagingSenderId: "736486429191",
    appId: "1:736486429191:web:25c116beb3994d213cd0a2"
};

// Firebase ကို တစ်ခါပဲ Init လုပ်ရန်
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();

// --- Configuration ---
const ADMIN_EMAIL = "uwinkyawdevelopbusinessco@gmail.com"; 
const IMGBB_KEY = "C8d8d00185e973ebcafddd34f77a1176"; 
const BUNNY_KEY = "a038d7e1-bf94-448b-b863c156422e-7e4a-4299"; 
const BUNNY_STORAGE = "public-hospitals";


async function getMyDeviceId() {
    try {
        // Library ရှိမရှိစစ်ခြင်း
        if (typeof FingerprintJS === 'undefined') {
            console.warn("FingerprintJS library is missing!");
            return "unknown_device_id";
        }
        
        // Fingerprint agent ကို load လုပ်ပြီး ID ယူခြင်း
        const fpPromise = FingerprintJS.load();
        const fp = await fpPromise;
        const result = await fp.get();
        return result.visitorId; // တိကျတဲ့ Device ID ကို return ပြန်ပေးပါမယ်
    } catch (e) { 
        console.error("Fingerprint Error:", e);
        return "error_generating_id"; 
    }
}
// --- ၂။ Video & Scroll Observers ---
const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const video = entry.target;
        if (entry.intersectionRatio < 0.8) {
            video.pause();
        } else {
            video.play().catch(e => console.log("Auto-play blocked"));
        }
    });
}, { threshold: [0.8] });

const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const postId = entry.target.getAttribute('data-id');
            if (postId && entry.target.getAttribute('data-viewed') !== "true") {
                incrementView(postId);
                entry.target.setAttribute('data-viewed', "true");
                scrollObserver.unobserve(entry.target);
            }
        }
    });
}, { threshold: 0.5 });

function observeElements() {
    document.querySelectorAll('video').forEach(v => videoObserver.observe(v));
    document.querySelectorAll('.post-card').forEach(post => scrollObserver.observe(post));
}

auth.onAuthStateChanged(async (user) => {
    const nameDisplay = document.getElementById('userNameDisplay');
    const nameModal = document.getElementById('nameSetupModal');
    const adminBadge = document.getElementById('adminBadge'); // Admin Badge အတွက်
    const gmailBtn = document.getElementById('gmailBtn'); // Login/Logout ခလုတ်အတွက်

    if (user) {
        // --- ၁။ Gmail Login နဲ့ Admin Check Logic ---
        if (gmailBtn) {
            gmailBtn.innerText = "Logout";
            gmailBtn.onclick = () => { auth.signOut(); location.reload(); };
        }
        
        // Admin Email နဲ့ ကိုက်ညီရင် Badge ပြမယ်
        if (user.email === ADMIN_EMAIL) {
            if (adminBadge) adminBadge.style.display = 'inline-block';
        }

        // --- ၂။ Senior ရဲ့ နဂို Device Lock Logic ---
        const currentDevId = await getMyDeviceId();
        const userRef = db.collection("users").doc(user.uid);
        const doc = await userRef.get();

        const userData = {
            uid: user.uid,
            email: user.email || "", // Email ပါ သိမ်းထားပေးမယ် Senior
            deviceId: currentDevId,
            displayName: user.displayName || "User_" + user.uid.substring(0,5),
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (doc.exists) {
            // Device Lock စစ်ဆေးခြင်း
            if (doc.data().deviceId && doc.data().deviceId !== currentDevId) {
                alert("Account Error: ဤအကောင့်ကို အခြားဖုန်းတွင် သုံးထားပြီးသားဖြစ်သည်။");
                await auth.signOut();
                location.reload();
                return;
            }
            await userRef.set(userData, { merge: true });
        } else {
            await userRef.set(userData);
        }

        // --- ၃။ UI ပိုင်းဆိုင်ရာ Logic ---
        if (!user.displayName) {
            if(nameModal) nameModal.style.display = 'flex';
        } else {
            if(nameModal) nameModal.style.display = 'none';
            if(nameDisplay) nameDisplay.innerText = user.displayName;
        }

        // Ban ခံထားရလား စစ်ဆေးခြင်း (Senior ရဲ့ အရင် function ကို ပြန်ခေါ်ပေးထားပါတယ်)
        checkBanStatus(user.uid, currentDevId);
        
    } else {
        // Guest User ဖြစ်နေရင်
        if(nameDisplay) nameDisplay.innerText = "ဧည့်သည် (Guest)";
        if(adminBadge) adminBadge.style.display = 'none';
        if(gmailBtn) {
            gmailBtn.innerText = "Login with Gmail";
            gmailBtn.onclick = () => { loginWithGoogle(); };
        }
    }
    
    // Post များ ဆွဲတင်ခြင်း
    if (!window.postsLoaded) { loadPosts(); window.postsLoaded = true; }
});
// --- ၄။ Post Logic (စင်းလုံးချော Version) ---
async function uploadAndPost() {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ");
    
    const text = document.getElementById('postContent').value.trim();
    
    // 🔥 ပြင်ဆင်ချက် ၁ - Input ID တွေကို HTML အသစ်အတိုင်း ညှိလိုက်တာပါ
    const imageInput = document.getElementById('imageInput');
    const videoInput = document.getElementById('videoInput');
    const file = imageInput.files[0] || videoInput.files[0]; 
    
    const btn = document.getElementById('btnPost');

    // ဖိုင်ဆိုဒ် စစ်ဆေးခြင်း
    if (file && file.size > 20 * 1024 * 1024) return alert("ဖိုင်ဆိုဒ် ၂၀ MB ထက်ကျော်နေပါတယ် Senior!");
    if (!text && !file) return alert("စာ သို့မဟုတ် ဖိုင်ထည့်ပါ");

    btn.disabled = true; 
    btn.innerText = "တင်နေသည်...";
    let mediaUrl = "", mediaType = "";

    try {
        if (file) {
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

            if (file.type.startsWith('video/')) {
                mediaType = 'video';
                
                // Bunny.net သို့ ဗီဒီယို တိုက်ရိုက်တင်ခြင်း (Original Logic အတိုင်းပါပဲ)
                const res = await fetch(`https://sg.storage.bunnycdn.com/${BUNNY_STORAGE}/${fileName}`, { 
                    method: 'PUT', 
                    headers: { 
                        'AccessKey': BUNNY_KEY, 
                        'Content-Type': 'application/octet-stream' 
                    },
                    body: file
                });

                if (res.ok) {
                    mediaUrl = `https://public-hospitals.b-cdn.net/${fileName}`;
                } else {
                    const errorMsg = await res.text();
                    throw new Error(`Bunny.net Upload Failed (${res.status}): ${errorMsg}`);
                }
            } else {
                // ပုံတင်ခြင်း (ImgBB Original Logic အတိုင်းပါပဲ)
                mediaType = 'image';
                const fd = new FormData(); 
                fd.append('image', file);
                const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { 
                    method: 'POST', 
                    body: fd 
                });
                const data = await res.json();
                if (data.success) {
                    mediaUrl = data.data.url;
                } else {
                    throw new Error("ပုံတင်လို့မရပါ (ImgBB Error)");
                }
            }
        }

        // Firestore ထဲသိမ်းဆည်းခြင်း (Original Logic မပြောင်းလဲပါ)
        await db.collection("health_posts").add({
            author: auth.currentUser.displayName || "User",
            text: text, 
            mediaUrl: mediaUrl, 
            mediaType: mediaType,
            likes: 0, 
            hahas: 0, 
            views: 0, 
            shares: 0,
            likedBy: [], 
            hahaedBy: [], 
            comments: [],
            isPinned: false, 
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 🔥 ပြင်ဆင်ချက် ၂ - တင်ပြီးသွားရင် UI ရှင်းလင်းတဲ့အပိုင်း
        document.getElementById('postContent').value = "";
        imageInput.value = "";
        videoInput.value = "";
        
        // Preview တွေအကုန် ပြန်ဖျောက်မယ်
        const imgPreview = document.getElementById('imgPreview');
        const videoPreview = document.getElementById('videoPreview');
        if(imgPreview) imgPreview.style.display = 'none';
        if(videoPreview) videoPreview.style.display = 'none';
        
        alert("တင်ပြီးပါပြီ Senior!");

    } catch (e) { 
        console.error(e);
        alert("Error: " + e.message); 
    } finally { 
        btn.disabled = false; 
        btn.innerText = "တင်မည်"; 
    }
}

function loadPosts() {
    const feed = document.getElementById('newsFeed');
    if(!feed) return;

    db.collection("health_posts").orderBy("createdAt", "desc").onSnapshot(snap => {
        const uid = auth.currentUser ? auth.currentUser.uid : "visitor";
        const isAdmin = auth.currentUser?.email === ADMIN_EMAIL;

        snap.docChanges().forEach(change => {
            const id = change.doc.id;
            const d = change.doc.data();
            let postEl = document.getElementById(`post-${id}`);

            if (change.type === "added" && !postEl) {
                const div = document.createElement('div');
                div.id = `post-${id}`;
                div.className = "post-card";
                div.setAttribute('data-id', id);
                div.style = `background:white; margin-bottom:15px; padding:15px; border-radius:12px; color:black; border:${d.isPinned?'2px solid purple':''}; box-shadow: 0 2px 5px rgba(0,0,0,0.1);`;
                div.innerHTML = renderPostHTML(id, d, uid, isAdmin);
                if (d.isPinned) feed.prepend(div); else feed.appendChild(div);
            } 
            else if (change.type === "modified" && postEl) {
                // --- တစ်ပြင်လုံး မပျောက်စေရန် ဤနေရာကို ပြင်ဆင်ထားသည် ---
                
                // ၁။ Reaction အပိုင်းကိုပဲ Update လုပ်မည်
                const isLiked = (d.likedBy || []).includes(uid);
                const isHahaed = (d.hahaedBy || []).includes(uid);
                
                // Reaction Bar ကို ID သပ်သပ်မပေးဘဲ HTML structure အတိုင်း ရှာပြီး update လုပ်ခြင်း
                const reactionArea = postEl.querySelector('.action-bar-content'); 
                if (reactionArea) {
                    reactionArea.innerHTML = `
                        <span onclick="handleReact('${id}', 'likes')" style="cursor:pointer; font-weight:bold; color:${isLiked?'blue':'gray'}">👍 ${d.likes||0}</span>
                        <span onclick="handleReact('${id}', 'hahas')" style="cursor:pointer; font-weight:bold; color:${isHahaed?'orange':'gray'}">😆 ${d.hahas||0}</span>
                    `;
                }

                // ၂။ View နဲ့ Share count ကို Update လုပ်မည်
                const statArea = postEl.querySelector('.stat-content');
                if (statArea) {
                    statArea.innerHTML = `👁️ ${d.views||0} | <span onclick="handleShare('${id}')" style="cursor:pointer; color:purple;">🚀 Share (${d.shares||0})</span>`;
                }

                // ၃။ Comment အပိုင်းကို Update လုပ်မည်
                const commArea = document.getElementById(`comms-${id}`);
                if (commArea) {
                    commArea.innerHTML = renderComments(id, d.comments, isAdmin, uid);
                }

                postEl.style.border = d.isPinned ? '2px solid purple' : 'none';
            } 
            else if (change.type === "removed" && postEl) {
                postEl.remove();
            }
        });
        
        // Element အသစ်တက်မှသာ observer ပြန်ခေါ်ရန် (Video တန့်မသွားစေရန်)
        if (snap.docChanges().some(c => c.type === "added")) observeElements();
    });
}
function formatTime(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return "ခုနကတင်";
    if (diff < 3600) return Math.floor(diff / 60) + " မိနစ်ခန့်က";
    if (diff < 86400) return Math.floor(diff / 3600) + " နာရီခန့်က";
    if (diff < 172800) return "မနေ့က";
    
    // ၂ ရက်ထက်ကျော်ရင် ရက်စွဲအတိုင်းပြမယ်
    return date.toLocaleDateString('my-MM', { day: 'numeric', month: 'short', year: 'numeric' });
}
function renderPostHTML(id, d, uid, isAdmin) {
    const isLiked = (d.likedBy || []).includes(uid);
    const isHahaed = (d.hahaedBy || []).includes(uid);
    
    // ၁။ အချိန်ကို တွက်ချက်ခြင်း
    const timeDisplay = formatTime(d.createdAt);

    // ၂။ ဗီဒီယိုနှင့် ပုံများအတွက် Logic
    let media = "";
    if (d.mediaUrl) {
        // ဗီဒီယိုဖြစ်ကြောင်း စစ်ဆေးခြင်း
        if (d.mediaType === 'video' || d.mediaUrl.toLowerCase().includes('.mp4')) {
            let finalVideoUrl = d.mediaUrl;

            // 🔥 Bunny CDN URL Fix: URL ထဲမှာ Storage Name နှစ်ခါ ထပ်မနေအောင် စစ်ဆေးမယ်
            // အကယ်၍ URL က b-cdn.net နဲ့ ဆုံးနေပြီး storage name မပါသေးမှသာ replace လုပ်မယ်
            if (finalVideoUrl.includes('b-cdn.net') && !finalVideoUrl.includes('/public-hospitals/')) {
                finalVideoUrl = finalVideoUrl.replace('b-cdn.net/', 'b-cdn.net/public-hospitals/');
            }

            media = `
                <div style="margin-top:10px; background:#000; border-radius:8px; overflow:hidden;">
                    <video onplay="incrementView('${id}')" controls playsinline preload="metadata" style="width:100%; display:block;">
                        <source src="${finalVideoUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>`;
        } else {
            // ပုံများအတွက် Logic (နဂိုအတိုင်းပါပဲ)
            media = `<img onclick="incrementView('${id}')" src="${d.mediaUrl}" style="width:100%; border-radius:8px; margin-top:10px; display:block; cursor:pointer;">`;
        }
    }

    // ၃။ UI ပြသခြင်း (နဂို Senior ရေးထားတဲ့ UI structure အတိုင်း ပြန်ဆက်ပေးထားပါတယ်)
    return `
        <div style="float:right; display:flex; gap:10px;">
            ${isAdmin ? `<button onclick="togglePin('${id}', ${d.isPinned || false})" style="border:none; background:none; cursor:pointer;">${d.isPinned ? '📌' : '📍'}</button>` : ''}
            ${isAdmin ? `<button onclick="deletePost('${id}')" style="border:none; background:none; cursor:pointer;">🗑️</button>` : ''}
        </div>
        
        <div style="display:flex; flex-direction:column; margin-bottom:10px;">
            <b style="color:purple; font-size:15px;">${d.author}</b>
            <small style="color:gray; font-size:11px;">${timeDisplay}</small>
        </div>

        <p style="margin:5px 0 10px 0; white-space:pre-wrap; font-size:14px; text-align:left; color:#333;">${d.text || ""}</p>
        
        ${media}
        
        <div style="display:flex; justify-content:space-between; margin-top:12px; border-top:1px solid #eee; padding-top:10px;">
            <div class="action-bar-content" style="display:flex; gap:15px;">
                <span onclick="handleReact('${id}', 'likes')" style="cursor:pointer; font-weight:bold; color:${isLiked?'blue':'gray'}; font-size:14px;">👍 Like (${d.likes||0})</span>
                <span onclick="handleReact('${id}', 'hahas')" style="cursor:pointer; font-weight:bold; color:${isHahaed?'orange':'gray'}; font-size:14px;">😆 Haha (${d.hahas||0})</span>
            </div>
            <div class="stat-content" style="font-size:12px; color:gray;">
                👁️ ${d.views||0} | <span onclick="handleShare('${id}')" style="cursor:pointer; color:purple; font-weight:bold;">🚀 Share (${d.shares||0})</span>
            </div>
        </div>

        <div style="margin-top:10px;">
            <div id="comms-${id}">${renderComments(id, d.comments, isAdmin, uid)}</div>
            <div style="display:flex; gap:5px; margin-top:10px;">
                <input type="text" id="in-${id}" placeholder="မှတ်ချက်..." style="flex:1; border-radius:15px; border:1px solid #ddd; padding:6px 12px; font-size:13px; outline:none; background:#f9f9f9;">
                <button onclick="addComment('${id}')" style="color:purple; border:none; background:none; font-weight:bold; cursor:pointer;">Send</button>
            </div>
        </div>`;
}

async function handleReact(id, type) {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ");
    const ref = db.collection("health_posts").doc(id);
    const snap = await ref.get();
    const d = snap.data();
    const uid = auth.currentUser.uid;
    const field = type==='likes'?'likedBy':'hahaedBy';
    const countField = type==='likes'?'likes':'hahas';

    if (d[field]?.includes(uid)) {
        await ref.update({ [field]: firebase.firestore.FieldValue.arrayRemove(uid), [countField]: firebase.firestore.FieldValue.increment(-1) });
    } else {
        await ref.update({ [field]: firebase.firestore.FieldValue.arrayUnion(uid), [countField]: firebase.firestore.FieldValue.increment(1) });
    }
}

async function addComment(id) {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ");
    const val = document.getElementById(`in-${id}`).value.trim();
    if (!val) return;
    await db.collection("health_posts").doc(id).update({
        comments: firebase.firestore.FieldValue.arrayUnion({
            uid: auth.currentUser.uid, author: auth.currentUser.displayName, text: val,
            likes:0, likedBy:[], hahas:0, hahaedBy:[], createdAt: Date.now()
        })
    });
    document.getElementById(`in-${id}`).value = "";
}

function renderComments(postId, comments, isAdmin, uid) {
    if (!comments || comments.length === 0) return "";

    // ၁။ Reaction (Like + Haha) အများဆုံးရတဲ့ Comment ကို ရှာပြီး အပေါ်ဆုံးတင်ရန် Sort လုပ်မည်
    const sortedComments = [...comments].sort((a, b) => {
        const scoreA = (a.likes || 0) + (a.hahas || 0);
        const scoreB = (b.likes || 0) + (b.hahas || 0);
        return scoreB - scoreA; // အများဆုံးက အပေါ်ဆုံးရောက်မည်
    });

    const limit = 5;
    const hasMore = sortedComments.length > limit;
    const displayedComments = sortedComments.slice(0, limit);

    // ပထမ ၅ ခုကို Render လုပ်မည် (နံပါတ် ၁ က Top Comment ဖြစ်နေမည်)
    let html = displayedComments.map((c, i) => {
        const isTop = (i === 0 && ((c.likes||0) + (c.hahas||0) > 0)); // Reaction ရှိမှ Top Badge ပြရန်
        return `
        <div style="background:#f0f2f5; margin-bottom:5px; padding:8px; border-radius:8px; font-size:12px; text-align:left; border-left:${isTop?'4px solid gold':''}">
            ${isTop ? '<small style="color:#d4af37; font-weight:bold;">🏆 Top Comment</small><br>' : ''}
            <b>${c.author}</b>: ${c.text}
            <div style="margin-top:4px; display:flex; gap:10px;">
                <span onclick="reactComment('${postId}', ${comments.indexOf(c)}, 'likes')" style="cursor:pointer; color:${(c.likedBy||[]).includes(uid)?'blue':'gray'}">👍 ${c.likes||0}</span>
                <span onclick="reactComment('${postId}', ${comments.indexOf(c)}, 'hahas')" style="cursor:pointer; color:${(c.hahaedBy||[]).includes(uid)?'orange':'gray'}">😆 ${c.hahas||0}</span>
                ${isAdmin ? `<span onclick="deleteComment('${postId}', ${comments.indexOf(c)})" style="color:red; cursor:pointer; margin-left:auto;">ဖျက်ရန်</span>` : ''}
            </div>
        </div>`;
    }).join('');

    // ၅ ခုထက်ပိုလျှင် "ပိုဖတ်ရန်" ခလုတ်ထည့်မည်
    if (hasMore) {
        html += `<div id="more-btn-${postId}" onclick="showAllComments('${postId}')" style="color:purple; font-size:12px; cursor:pointer; font-weight:bold; margin-top:5px; padding:5px;">
            💬 နောက်ထပ်မှတ်ချက် ${sortedComments.length - limit} ခုကို ဖတ်ရန်...
        </div>`;
        
        html += `<div id="extra-comms-${postId}" style="display:none;">
            ${sortedComments.slice(limit).map((c) => `
                <div style="background:#f0f2f5; margin-bottom:5px; padding:8px; border-radius:8px; font-size:12px; text-align:left;">
                    <b>${c.author}</b>: ${c.text}
                    <div style="margin-top:4px; display:flex; gap:10px;">
                        <span onclick="reactComment('${postId}', ${comments.indexOf(c)}, 'likes')" style="cursor:pointer; color:${(c.likedBy||[]).includes(uid)?'blue':'gray'}">👍 ${c.likes||0}</span>
                        <span onclick="reactComment('${postId}', ${comments.indexOf(c)}, 'hahas')" style="cursor:pointer; color:${(c.hahaedBy||[]).includes(uid)?'orange':'gray'}">😆 ${c.hahas||0}</span>
                        ${isAdmin ? `<span onclick="deleteComment('${postId}', ${comments.indexOf(c)})" style="color:red; cursor:pointer; margin-left:auto;">ဖျက်ရန်</span>` : ''}
                    </div>
                </div>`).join('')}
        </div>`;
    }

    return html;
}
async function reactComment(postId, index, type) {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ");
    const ref = db.collection("health_posts").doc(postId);
    const snap = await ref.get();
    let comments = [...snap.data().comments];
    let c = comments[index];
    const uid = auth.currentUser.uid;
    const f = type === 'likes' ? 'likedBy' : 'hahaedBy';
    const cf = type === 'likes' ? 'likes' : 'hahas';

    if (!c[f]) c[f] = [];
    
    let isAddingReaction = false; // Notification ပို့သင့်မပို့သင့် စစ်ရန်

    if (c[f].includes(uid)) {
        // Reaction ကို ပြန်ဖြုတ်တာ (Unlike / Un-haha)
        c[f] = c[f].filter(x => x !== uid);
        c[cf] = Math.max(0, (c[cf] || 0) - 1);
    } else {
        // Reaction အသစ်ပေးတာ
        c[f].push(uid);
        c[cf] = (c[cf] || 0) + 1;
        isAddingReaction = true; 
    }

    // Database Update လုပ်မယ်
    await ref.update({ comments });


    if (isAddingReaction && c.uid !== uid) {
        const reactionName = type === 'likes' ? "Like ❤️" : "Haha 😂";
        
        await db.collection("notifications").add({
            receiverId: c.uid, // Comment ပိုင်ရှင်ရဲ့ UID
            senderId: uid,
            title: "Reaction အသစ်ရှိပါသည်",
            body: `${auth.currentUser.displayName || "User"} က သင်၏ Comment ကို ${reactionName} ပေးလိုက်ပါတယ်`,
            status: "unread",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
}

async function deleteComment(postId, index) {
    if(!confirm("ဤမှတ်ချက်ကို ဖျက်မလား Senior?")) return;
    const ref = db.collection("health_posts").doc(postId);
    const snap = await ref.get();
    let comments = [...snap.data().comments];
    comments.splice(index, 1);
    await ref.update({ comments });
}

async function togglePin(id, current) { await db.collection("health_posts").doc(id).update({ isPinned: !current }); }
async function deletePost(id) { if(confirm("ဖျက်မှာလား Senior?")) await db.collection("health_posts").doc(id).delete(); }
async function incrementView(id) { db.collection("health_posts").doc(id).update({ views: firebase.firestore.FieldValue.increment(1) }); }
async function handleShare(id) {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ Senior");
    
    try {
        const ref = db.collection("health_posts").doc(id);
        const snap = await ref.get();
        const d = snap.data();

        // ၁။ မူရင်း Post ရဲ့ Share Count ကို +1 တိုးမယ်
        await ref.update({ shares: firebase.firestore.FieldValue.increment(1) });

        // ၂။ Post အသစ်တစ်ခုအနေနဲ့ Feed ထဲကို ထပ်ထည့်မယ် (ဒါမှ သူများတွေ မြင်ရမှာပါ)
        await db.collection("health_posts").add({
            ...d, // မူရင်းစာနဲ့ ပုံတွေကို ယူမယ်
            author: `${auth.currentUser.displayName} (Shared)`, // Share တဲ့လူအမည်ပြမယ်
            uid: "shared_post", // *** အရေးကြီးသည်- uid နေရာမှာ shared_post လို့ ပြောင်းလိုက်ရင် Profile မှာ ပေါ်မှာမဟုတ်တော့ပါဘူး
            likes: 0, likedBy: [], 
            hahas: 0, hahaedBy: [], 
            comments: [], 
            shares: 0,
            views: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Shared to News Feed!");
    } catch (e) {
        alert("Share လုပ်လို့မရပါဘူး Senior: " + e.message);
    }
}
function previewMedia(input) {
    const box = document.getElementById('mediaPreviewBox');
    const file = input.files[0];
    if (file) {
        box.style.display = 'block';
        const url = URL.createObjectURL(file);
        if (file.type.startsWith('video/')) {
            box.innerHTML = `<video src="${url}" style="width:100%; border-radius:8px;" muted autoplay loop></video>`;
        } else {
            box.innerHTML = `<img src="${url}" style="width:100%; border-radius:8px;">`;
        }
    }
}

async function saveInitialName() {
    const name = document.getElementById('setupUserName').value.trim();
    if(name.length < 2) return alert("အမည်အမှန်ရိုက်ပါ");
    await auth.currentUser.updateProfile({ displayName: name });
    location.reload();
}
// ဒီ Function လေးကို script.js ရဲ့ အောက်ဆုံးမှာ ထပ်ထည့်ပေးပါ Senior
function showAllComments(postId) {
    const extra = document.getElementById(`extra-comms-${postId}`);
    const btn = document.getElementById(`more-btn-${postId}`);
    if (extra && btn) {
        extra.style.display = 'block'; // Hide ထားတာကို ပြန်ပြမယ်
        btn.style.display = 'none';    // ဖတ်ရန် ဆိုတဲ့ ခလုတ်ကို ဖျောက်မယ်
    }
}
// ကိုယ့်ဆီရောက်လာတဲ့ Notification တွေကို အမြဲစောင့်ကြည့်မယ်
function startLiveNotifications() {
    const myUid = auth.currentUser.uid;
    db.collection("notifications")
      .where("receiverId", "==", myUid)
      .where("status", "==", "unread")
      .onSnapshot(snap => {
          snap.docChanges().forEach(change => {
              if (change.type === "added") {
                  const d = change.doc.data();
                  // Notification ပြမယ်
                  new Notification(d.title, { body: d.body });
                  // ပြပြီးရင် read လုပ်မယ်
                  db.collection("notifications").doc(change.doc.id).update({ status: "read" });
              }
          });
      });
}
// --- Auto Friend System (Mass Add) ---
async function startAutoFriendSystem(myUid) {
    try {
        const myRef = db.collection("users").doc(myUid);
        const myDoc = await myRef.get();
        const myData = myDoc.data();

        const limit = myData.friendLimit || 3000; // Default 3000
        let currentCount = myData.friendCount || 0;

        // ၁။ Database ထဲက တခြား User တွေကို ဆွဲထုတ်မယ်
        const usersSnap = await db.collection("users")
            .where("uid", "!=", myUid)
            .limit(100) // တစ်ခါတိုးရင် လူ ၁၀၀ စီပဲ တိုးမယ် (Database မပိအောင်)
            .get();

        for (const doc of usersSnap.docs) {
            const otherUser = doc.data();

            // ၂။ Limit မပြည့်သေးရင် Friend အဖြစ် ထည့်မယ်
            if (currentCount < limit) {
                // ကိုယ့် Friend List ထဲကို သူများကိုထည့်မယ်
                await myRef.collection("friends").doc(otherUser.uid).set({
                    uid: otherUser.uid,
                    displayName: otherUser.displayName,
                    addedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // တစ်ဖက်လူရဲ့ Friend List ထဲကို ကိုယ့်ကိုပြန်ထည့်မယ် (Auto Mutual Friends)
                await db.collection("users").doc(otherUser.uid).collection("friends").doc(myUid).set({
                    uid: myUid,
                    displayName: myData.displayName,
                    addedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                currentCount++;
            } else {
                console.log("Friend Limit Reached: " + limit);
                break; // Limit ပြည့်ရင် ရပ်မယ်
            }
        }

        // ၃။ Friend Count ကို Update လုပ်မယ်
        await myRef.update({ friendCount: currentCount });

    } catch (e) {
        console.error("AutoFriend Error:", e);
    }
}
// App ထဲ စဝင်တာနဲ့ Ban ခံထားရလား စစ်မယ်
async function checkBanStatus(userId, deviceId) {
    // ၁။ Device ID နဲ့ စစ်မယ်
    const deviceSnap = await db.collection("banned_devices").doc(deviceId).get();
    
    // ၂။ User UID နဲ့ စစ်မယ်
    const userSnap = await db.collection("users").doc(userId).get();
    const userData = userSnap.data();

    if (deviceSnap.exists || (userData && userData.isBanned)) {
        alert("သင့် Device သည် စည်းကမ်းဖောက်ဖျက်မှုကြောင့် အပြီးတိုင် ပိတ်ပင် (Ban) ခံထားရပါသည်။");
        auth.signOut();
        window.location.href = "banned_info.html"; // Ban ခံရကြောင်း ပြမယ့်စာမျက်နှာ
    }
}
// --- Feedback တင်ပေးမည့် Function ---
async function submitFeedback() {
    const msg = document.getElementById('feedbackMsg').value.trim();
    if (!msg) return alert("စာသားလေး တစ်ခုခု ရေးပေးပါဦး Senior");

    try {
        const user = auth.currentUser;
        // Device အချက်အလက်ယူခြင်း (Admin သိအောင်)
        const deviceInfo = navigator.userAgent.split(')')[0].split('(')[1] || "Unknown Device";

        await db.collection("feedbacks").add({
            uid: user.uid,
            userName: user.displayName || "အမည်မသိ",
            feedbackMsg: msg,
            device: deviceInfo,
            version: "1.0.0", // Senior ရဲ့ App Version
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("ကျေးဇူးတင်ပါတယ် Senior! Feedback ကို Admin Panel ဆီ ပို့လိုက်ပါပြီ။");
        document.getElementById('feedbackMsg').value = ""; // စာသားပြန်ဖျက်မယ်
    } catch (e) {
        alert("Error: " + e.message);
    }
}

