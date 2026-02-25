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

function getBadgeHTML(data) {
    if (data.isCrown) {
        // ခရမ်းရောင် Crown Badge
        return ` <span class="badge-official crown-bg">👑 Official</span>`;
    } else if (data.isGold) {
        // ရွှေရောင် Gold $ Badge
        return ` <span class="badge-official gold-bg">$ Verified</span>`;
    }
    return "";
}

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
    
    if (user) {
        // ၁။ Device ID ရယူခြင်း
        const currentDevId = await getMyDeviceId();
        const userRef = db.collection("users").doc(user.uid);
        const doc = await userRef.get();

        // ၂။ Device Lock စစ်ဆေးခြင်း
        if (doc.exists) {
            const existingData = doc.data();
            if (existingData.deviceId && existingData.deviceId !== currentDevId) {
                alert("Account Error: ဤအကောင့်ကို အခြားဖုန်းတွင် သုံးထားပြီးသားဖြစ်သည်။");
                await auth.signOut();
                location.reload();
                return;
            }
        }

        // ၃။ အချက်အလက်များ သိမ်းဆည်း/Update လုပ်ခြင်း
        // အကယ်၍ နာမည်အသစ်ပေးမယ်ဆိုရင် trim လုပ်ပြီးမှ သိမ်းမယ်
        const currentName = user.displayName ? user.displayName.trim() : "User_" + user.uid.substring(0,5);
        
        const userData = {
            uid: user.uid,
            deviceId: currentDevId,
            displayName: currentName,
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        };
        await userRef.set(userData, { merge: true });

        // ၄။ Auto Friend System
        const isAlreadyAdded = doc.exists ? doc.data().isAutoFriendAdded : false;
        if (!isAlreadyAdded) {
            await startAutoFriendSystem(user.uid);
        }

        // ၅။ UI အပိုင်း ပြင်ဆင်ခြင်း (Regex Validation ဖြင့် စစ်ဆေးသည်)
        if (!user.displayName || !isSafeName(user.displayName)) {
            // နာမည်မရှိရင် (သို့) Emoji ပါနေရင် Modal ပြမည်
            if(nameModal) nameModal.style.display = 'flex';
        } else {
            if(nameModal) nameModal.style.display = 'none';
            if(nameDisplay) {
                // နာမည်ဘေးတွင် Badge ကိုပါ တစ်ခါတည်း တွဲပြမည်
                const badgeHTML = doc.exists ? getBadgeHTML(doc.data()) : "";
                nameDisplay.innerHTML = `${user.displayName}${badgeHTML}`;
            }
        }

        // ၆။ Notifications စတင်ခြင်း
        if(typeof startLiveNotifications === 'function') startLiveNotifications();

    } else {
        if (nameDisplay) nameDisplay.innerText = "ဧည့်သည် (Guest)";
    }
    
    if (!window.postsLoaded) { 
        loadPosts(); 
        window.postsLoaded = true; 
    }
});

// --- ၄။ Post Logic (Senior ပြင်ပေးထားသော Version) ---
async function uploadAndPost() {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ");
    
    const text = document.getElementById('postContent').value.trim();
    const fileInput = document.getElementById('mediaInput');
    const file = fileInput.files[0];
    const btn = document.getElementById('btnPost');

    // ဖိုင်ဆိုဒ် စစ်ဆေးခြင်း
    if (file && file.size > 20 * 1024 * 1024) return alert("ဖိုင်ဆိုဒ် ၂၀ MB ထက်ကျော်နေပါတယ် Senior!");
    if (!text && !file) return alert("စာ သို့မဟုတ် ဖိုင်ထည့်ပါ");

    btn.disabled = true; 
    btn.innerText = "တင်နေသည်...";
    let mediaUrl = "", mediaType = "";

    try {
        if (file) {
            // ဖိုင်အမည်တွင် space များပါက _ ဖြင့် အစားထိုးရန်
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

            if (file.type.startsWith('video/')) {
                mediaType = 'video';
                
                // Bunny.net သို့ ဗီဒီယို တိုက်ရိုက်တင်ခြင်း
              const res = await fetch(`https://sg.storage.bunnycdn.com/${BUNNY_STORAGE}/${fileName}`, { 
                    method: 'PUT', 
                    headers: { 
                        'AccessKey': BUNNY_KEY, 
                        'Content-Type': 'application/octet-stream' 
                    },
                    body: file
                });

                if (res.ok) {
                    // ဗီဒီယိုပြန်ကြည့်ရန် Link (Storage Name ကို URL ထဲတွင် တစ်ခါပဲထည့်ခြင်း)
                    mediaUrl = `https://public-hospitals.b-cdn.net/${fileName}`;
                } else {
                    const errorMsg = await res.text();
                    throw new Error(`Bunny.net Upload Failed (${res.status}): ${errorMsg}`);
                }
            } else {
                // ပုံတင်ခြင်း (ImgBB)
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

        // Firebase Firestore ထဲသို့ အချက်အလက်များ သိမ်းဆည်းခြင်း
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

        // UI အားလုံးကို မူလအတိုင်း ပြန်ဖြစ်စေရန်
        document.getElementById('postContent').value = "";
        fileInput.value = "";
        document.getElementById('mediaPreviewBox').style.display = 'none';
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
                
                // Senior ရဲ့ renderPostHTML ဆီကို d (post data) တစ်ခုလုံး ပို့လိုက်တာမို့လို့ 
                // အထဲမှာ Badge logic သုံးလို့ရသွားပါပြီ
                div.innerHTML = renderPostHTML(id, d, uid, isAdmin); 
                
                if (d.isPinned) feed.prepend(div); else feed.appendChild(div);
            } 
            else if (change.type === "modified" && postEl) {
                const isLiked = (d.likedBy || []).includes(uid);
                const isHahaed = (d.hahaedBy || []).includes(uid);
                
                const reactionArea = postEl.querySelector('.action-bar-content'); 
                if (reactionArea) {
                    reactionArea.innerHTML = `
                        <span onclick="handleReact('${id}', 'likes')" style="cursor:pointer; font-weight:bold; color:${isLiked?'blue':'gray'}">👍 ${d.likes||0}</span>
                        <span onclick="handleReact('${id}', 'hahas')" style="cursor:pointer; font-weight:bold; color:${isHahaed?'orange':'gray'}">😆 ${d.hahas||0}</span>
                    `;
                }

                const statArea = postEl.querySelector('.stat-content');
                if (statArea) {
                    statArea.innerHTML = `👁️ ${d.views||0} | <span onclick="handleShare('${id}')" style="cursor:pointer; color:purple;">🚀 Share (${d.shares||0})</span>`;
                }

                const commArea = document.getElementById(`comms-${id}`);
                if (commArea) {
                    // Comment တွေမှာလည်း Badge ပါအောင် d.comments ကို ပို့ထားပါတယ်
                    commArea.innerHTML = renderComments(id, d.comments, isAdmin, uid);
                }

                postEl.style.border = d.isPinned ? '2px solid purple' : 'none';
            } 
            else if (change.type === "removed" && postEl) {
                postEl.remove();
            }
        });
        
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

    // --- Badge Logic ထည့်သွင်းခြင်း ---
    let badge = "";
    if (d.isCrown) {
        badge = ` <span class="badge-official crown-bg" style="font-size:10px; padding:2px 5px; vertical-align:middle;">👑 Official</span>`;
    } else if (d.isGold) {
        badge = ` <span class="badge-official gold-bg" style="font-size:10px; padding:2px 5px; vertical-align:middle;">$ Verified</span>`;
    }

    // ၂။ ဗီဒီယိုနှင့် ပုံများအတွက် Logic
    let media = "";
    if (d.mediaUrl) {
        if (d.mediaType === 'video' || d.mediaUrl.toLowerCase().includes('.mp4')) {
            let finalVideoUrl = d.mediaUrl;
            if (finalVideoUrl.includes('b-cdn.net') && !finalVideoUrl.includes('b-cdn.net/public-hospitals/')) {
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
            media = `<img onclick="incrementView('${id}')" src="${d.mediaUrl}" style="width:100%; border-radius:8px; margin-top:10px; display:block; cursor:pointer;">`;
        }
    }

    // ၃။ UI ပြသခြင်း
    return `
        <div style="float:right; display:flex; gap:10px;">
            ${isAdmin ? `<button onclick="togglePin('${id}', ${d.isPinned || false})" style="border:none; background:none; cursor:pointer;">${d.isPinned ? '📌' : '📍'}</button>` : ''}
            ${isAdmin ? `<button onclick="deletePost('${id}')" style="border:none; background:none; cursor:pointer;">🗑️</button>` : ''}
        </div>
        
        <div style="display:flex; flex-direction:column; margin-bottom:10px;">
            <b style="color:purple; font-size:15px; display: flex; align-items: center; gap: 5px;">
                ${d.author}${badge} </b>
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

    try {
        // --- Badge အတွက် User Status ကို အရင်ယူမယ် ---
        const userDoc = await db.collection("users").doc(auth.currentUser.uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const isCrown = userData.isCrown || false;
        const isGold = userData.isGold || false;

        await db.collection("health_posts").doc(id).update({
            comments: firebase.firestore.FieldValue.arrayUnion({
                uid: auth.currentUser.uid, 
                author: auth.currentUser.displayName, 
                isCrown: isCrown, // <--- ထည့်သိမ်းလိုက်ပြီ
                isGold: isGold,   // <--- ထည့်သိမ်းလိုက်ပြီ
                text: val,
                likes:0, likedBy:[], hahas:0, hahaedBy:[], createdAt: Date.now()
            })
        });
        document.getElementById(`in-${id}`).value = "";
    } catch (e) {
        console.error(e);
    }
}
function renderComments(postId, comments, isAdmin, uid) {
    if (!comments || comments.length === 0) return "";

    const sortedComments = [...comments].sort((a, b) => {
        const scoreA = (a.likes || 0) + (a.hahas || 0);
        const scoreB = (b.likes || 0) + (b.hahas || 0);
        return scoreB - scoreA;
    });

    // --- Badge Helper Function ---
    const getBadgeHTML = (c) => {
        if (c.isCrown) return ` <span class="badge-official crown-bg" style="font-size:10px; padding:2px 4px;">👑 Official</span>`;
        if (c.isGold) return ` <span class="badge-official gold-bg" style="font-size:10px; padding:2px 4px;">$ Verified</span>`;
        return "";
    };

    const limit = 5;
    const hasMore = sortedComments.length > limit;
    const displayedComments = sortedComments.slice(0, limit);

    let html = displayedComments.map((c, i) => {
        const isTop = (i === 0 && ((c.likes||0) + (c.hahas||0) > 0));
        return `
        <div style="background:#f0f2f5; margin-bottom:5px; padding:8px; border-radius:8px; font-size:12px; text-align:left; border-left:${isTop?'4px solid gold':''}">
            ${isTop ? '<small style="color:#d4af37; font-weight:bold;">🏆 Top Comment</small><br>' : ''}
            <b>${c.author}${getBadgeHTML(c)}</b>: ${c.text} <div style="margin-top:4px; display:flex; gap:10px;">
                <span onclick="reactComment('${postId}', ${comments.indexOf(c)}, 'likes')" style="cursor:pointer; color:${(c.likedBy||[]).includes(uid)?'blue':'gray'}">👍 ${c.likes||0}</span>
                <span onclick="reactComment('${postId}', ${comments.indexOf(c)}, 'hahas')" style="cursor:pointer; color:${(c.hahaedBy||[]).includes(uid)?'orange':'gray'}">😆 ${c.hahas||0}</span>
                ${isAdmin ? `<span onclick="deleteComment('${postId}', ${comments.indexOf(c)})" style="color:red; cursor:pointer; margin-left:auto;">ဖျက်ရန်</span>` : ''}
            </div>
        </div>`;
    }).join('');

    if (hasMore) {
        html += `<div id="more-btn-${postId}" onclick="showAllComments('${postId}')" style="color:purple; font-size:12px; cursor:pointer; font-weight:bold; margin-top:5px; padding:5px;">
            💬 နောက်ထပ်မှတ်ချက် ${sortedComments.length - limit} ခုကို ဖတ်ရန်...
        </div>`;
        
        html += `<div id="extra-comms-${postId}" style="display:none;">
            ${sortedComments.slice(limit).map((c) => `
                <div style="background:#f0f2f5; margin-bottom:5px; padding:8px; border-radius:8px; font-size:12px; text-align:left;">
                    <b>${c.author}${getBadgeHTML(c)}</b>: ${c.text} <div style="margin-top:4px; display:flex; gap:10px;">
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

    // --- Auto Notification Logic ---
    // Reaction ပေးတာဖြစ်ရမယ်၊ ကိုယ့် Comment ကိုယ်ပေးတာ မဟုတ်ရဘူး၊ ပြီးတော့ တစ်ဖက်လူ UID ရှိရမယ်
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
// --- Global Functions ---
function isSafeName(name) {
    if (!name) return false;
    const safePattern = /^[a-zA-Z0-9\u1000-\u109F\s]+$/;
    return safePattern.test(name);
}
// --- ၁။ နာမည်သိမ်းသည့် Function (ပေါင်းစည်းပြီးသား) ---
async function saveInitialName() {
    const nameElement = document.getElementById('setupUserName');
    if(!nameElement) return;

    const inputName = nameElement.value.trim();

    // စစ်ဆေးမှုများ (Validation Layers)
    if(inputName.length < 2) {
        return alert("အမည်အမှန်ရိုက်ပါ (အနည်းဆုံး ၂ လုံး)");
    }

    if (!isSafeName(inputName)) {
        return alert("Senior ရေ... နာမည်မှာ Emoji နဲ့ Special Character တွေ မသုံးပါနဲ့ဗျာ။ စာသားနဲ့ ဂဏန်းပဲ သုံးပေးပါ။");
    }

    try {
        // Firebase Auth Update
        await auth.currentUser.updateProfile({ 
            displayName: inputName 
        });

        // Firestore Database Update (Sync လုပ်ခြင်း)
        await db.collection("users").doc(auth.currentUser.uid).set({
            displayName: inputName,
            // နာမည်ပြင်ပြီးသားဖြစ်ကြောင်း Flag တစ်ခုပါ ထည့်ထားလို့ရတယ် Senior
            isProfileSetup: true 
        }, { merge: true });

        console.log("Success: Name updated to " + inputName);
        location.reload(); // ပြောင်းလဲမှုတွေ မြင်ရအောင် Reload လုပ်မယ်
        
    } catch (error) {
        console.error("Error saving name: ", error);
        alert("သိမ်းလို့မရဖြစ်နေပါတယ် Senior။ ခဏနေမှ ပြန်လုပ်ကြည့်ပါ။");
    }
}

// --- ၂။ Emoji စစ်ဆေးသည့် Function (Helper) ---
function isSafeName(name) {
    if (!name) return false;
    const safePattern = /^[a-zA-Z0-9\u1000-\u109F\s]+$/;
    return safePattern.test(name);
}

// --- ၃။ Comment အကုန်ပြသည့် Function ---
function showAllComments(postId) {
    const extra = document.getElementById(`extra-comms-${postId}`);
    const btn = document.getElementById(`more-btn-${postId}`);
    if (extra && btn) {
        extra.style.display = 'block';
        btn.style.display = 'none';
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
async function startAutoFriendSystem(myUid) {
    try {
        const myRef = db.collection("users").doc(myUid);
        const myDoc = await myRef.get();
        const myData = myDoc.data();

        // ၁။ ဒီ User ကို Auto Friend လုပ်ပေးပြီးသားလား အရင်စစ်မယ်
        if (myData.isAutoFriendAdded === true) {
            console.log("Auto friends already processed for this user.");
            return; // ပြီးသားဆိုရင် ဆက်မလုပ်တော့ဘူး (Database Load မတက်တော့ဘူး)
        }

        const limit = 50; // Senior ရေ... လူ ၃၀၀၀ ကို တစ်ခါတည်းထည့်ရင် Error တက်နိုင်လို့ ၅၀ စီပဲ အရင်စစ်ကြည့်ပါ
        let currentCount = 0;

        // ၂။ Database ထဲက အခြား User တွေကို ဆွဲထုတ်မယ်
        const usersSnap = await db.collection("users")
            .where("uid", "!=", myUid)
            .limit(limit) 
            .get();

        // ၃။ Batch Write သုံးပါမယ် (ဒါက Database speed ပိုမြန်ပြီး ပိုက်ဆံပိုသက်သာပါတယ်)
        const batch = db.batch();

        usersSnap.forEach(doc => {
            const otherUser = doc.data();
            
            // ကိုယ့်ဆီမှာ သူ့ကို Friend အဖြစ်ထည့်
            const myFriendRef = myRef.collection("friends").doc(otherUser.uid);
            batch.set(myFriendRef, {
                uid: otherUser.uid,
                displayName: otherUser.displayName || "User",
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // သူ့ဆီမှာ ကိုယ့်ကို Friend အဖြစ်ပြန်ထည့်
            const otherFriendRef = db.collection("users").doc(otherUser.uid).collection("friends").doc(myUid);
            batch.set(otherFriendRef, {
                uid: myUid,
                displayName: myData.displayName || "User",
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            currentCount++;
        });

        // ၄။ အားလုံးပြီးမှ Flag ကို True ပေးလိုက်မယ် (နောက်တစ်ခါ ဝင်ရင် ဒီ Function အလုပ်မလုပ်တော့ဘူး)
        batch.update(myRef, { 
            isAutoFriendAdded: true,
            friendCount: firebase.firestore.FieldValue.increment(currentCount)
        });

        await batch.commit();
        console.log(`Successfully added ${currentCount} auto friends.`);

    } catch (e) {
        console.error("AutoFriend Error:", e);
    }
}


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

