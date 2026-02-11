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

// --- ၁။ Device Fingerprint ---
async function getMyDeviceId() {
    try {
        if (typeof FingerprintJS === 'undefined') return "unknown_dev";
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        return result.visitorId;
    } catch (e) { return "error_id"; }
}

// --- ၂။ Video & Scroll Observers ---
const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const video = entry.target;
        if (entry.intersectionRatio < 0.8) {
            video.pause();
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

// --- ၃။ Auth & Device Lock Logic ---
auth.onAuthStateChanged(async (user) => {
    const nameDisplay = document.getElementById('userNameDisplay');
    const nameModal = document.getElementById('nameSetupModal');
    
    if (user) {
        const currentDevId = await getMyDeviceId();
        const userRef = db.collection("users").doc(user.uid);
        const doc = await userRef.get();

        if (doc.exists) {
            if (doc.data().deviceId && doc.data().deviceId !== currentDevId) {
                alert("Account Error: ဤအကောင့်ကို အခြားဖုန်းတွင် သုံးထားပြီးသားဖြစ်သည်။");
                await auth.signOut();
                location.reload();
                return;
            }
        } else {
            await userRef.set({ deviceId: currentDevId, name: user.displayName || "User" }, { merge: true });
        }

        if (!user.displayName) {
            if(nameModal) nameModal.style.display = 'flex';
        } else {
            if(nameModal) nameModal.style.display = 'none';
            if(nameDisplay) nameDisplay.innerText = user.displayName;
            if (user.email === ADMIN_EMAIL) {
                const badge = document.getElementById('adminBadge');
                if(badge) badge.style.display = 'inline-block';
            }
        }
    } else {
        if(nameDisplay) nameDisplay.innerText = "ဧည့်သည် (Guest)";
    }
    
    if (!window.postsLoaded) { 
        loadPosts(); 
        window.postsLoaded = true; 
    }
});

// --- ၄။ Post Logic ---
async function uploadAndPost() {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ");
    
    const text = document.getElementById('postContent').value.trim();
    const fileInput = document.getElementById('mediaInput');
    const file = fileInput.files[0];
    const btn = document.getElementById('btnPost');

    if (file && file.size > 20 * 1024 * 1024) return alert("ဖိုင်ဆိုဒ် ၂၀ MB ထက်ကျော်နေပါတယ် Senior!");
    if (!text && !file) return alert("စာ သို့မဟုတ် ဖိုင်ထည့်ပါ");

    btn.disabled = true; btn.innerText = "တင်နေသည်...";
    let mediaUrl = "", mediaType = "";

    try {
        if (file) {
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            if (file.type.startsWith('video/')) {
                mediaType = 'video';
                const res = await fetch(`https://storage.bunnycdn.com/${BUNNY_STORAGE}/${fileName}`, {
                    method: 'PUT', headers: { 'AccessKey': BUNNY_KEY, 'Content-Type': 'application/octet-stream' },
                    body: file
                });
                if (res.ok) mediaUrl = `https://public-hospitals.b-cdn.net/${fileName}`;
            } else {
                mediaType = 'image';
                const fd = new FormData(); fd.append('image', file);
                const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: fd });
                const data = await res.json();
                if (data.success) mediaUrl = data.data.url;
            }
        }

        await db.collection("health_posts").add({
            author: auth.currentUser.displayName || "User",
            text: text, mediaUrl, mediaType,
            likes: 0, hahas: 0, views: 0, shares: 0,
            likedBy: [], hahaedBy: [], comments: [],
            isPinned: false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById('postContent').value = "";
        fileInput.value = "";
        document.getElementById('mediaPreviewBox').style.display = 'none';
        alert("တင်ပြီးပါပြီ Senior!");
    } catch (e) { alert("Error: " + e.message); }
    finally { btn.disabled = false; btn.innerText = "တင်မည်"; }
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
function renderPostHTML(id, d, uid, isAdmin) {
    const isLiked = (d.likedBy || []).includes(uid);
    const isHahaed = (d.hahaedBy || []).includes(uid);
    const media = d.mediaUrl ? (d.mediaType==='video'?`<video controls style="width:100%; border-radius:8px; margin-top:10px;"><source src="${d.mediaUrl}"></video>`:`<img src="${d.mediaUrl}" style="width:100%; border-radius:8px; margin-top:10px;">`) : "";

    return `
        <div style="float:right; display:flex; gap:10px;">
            ${isAdmin ? `<button onclick="togglePin('${id}', ${d.isPinned})" style="border:none; background:none; cursor:pointer;">${d.isPinned?'📌':'📍'}</button>` : ''}
            ${isAdmin ? `<button onclick="deletePost('${id}')" style="border:none; background:none; cursor:pointer;">🗑️</button>` : ''}
        </div>
        <b style="color:purple;">${d.author}</b>
        <p style="margin:10px 0; white-space:pre-wrap; font-size:14px; text-align:left;">${d.text || ""}</p>
        ${media}
        <div style="display:flex; justify-content:space-between; margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
            <div class="action-bar-content" style="display:flex; gap:15px;">
                <span onclick="handleReact('${id}', 'likes')" style="cursor:pointer; font-weight:bold; color:${isLiked?'blue':'gray'}">👍 ${d.likes||0}</span>
                <span onclick="handleReact('${id}', 'hahas')" style="cursor:pointer; font-weight:bold; color:${isHahaed?'orange':'gray'}">😆 ${d.hahas||0}</span>
            </div>
            <div class="stat-content" style="font-size:12px; color:gray;">
                👁️ ${d.views||0} | <span onclick="handleShare('${id}')" style="cursor:pointer; color:purple;">🚀 Share (${d.shares||0})</span>
            </div>
        </div>
        <div style="margin-top:10px;">
            <div id="comms-${id}">${renderComments(id, d.comments, isAdmin, uid)}</div>
            <div style="display:flex; gap:5px; margin-top:10px;">
                <input type="text" id="in-${id}" placeholder="မှတ်ချက်..." style="flex:1; border-radius:15px; border:1px solid #ddd; padding:5px 10px;">
                <button onclick="addComment('${id}')" style="color:purple; border:none; background:none; font-weight:bold;">Send</button>
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
    return (comments || []).map((c, i) => `
        <div style="background:#f0f2f5; margin-bottom:5px; padding:8px; border-radius:8px; font-size:12px; text-align:left;">
            <b>${c.author}</b>: ${c.text}
            <div style="margin-top:4px; display:flex; gap:10px;">
                <span onclick="reactComment('${postId}', ${i}, 'likes')" style="cursor:pointer; color:${(c.likedBy||[]).includes(uid)?'blue':'gray'}">👍 ${c.likes||0}</span>
                <span onclick="reactComment('${postId}', ${i}, 'hahas')" style="cursor:pointer; color:${(c.hahaedBy||[]).includes(uid)?'orange':'gray'}">😆 ${c.hahas||0}</span>
                ${isAdmin ? `<span onclick="deleteComment('${postId}', ${i})" style="color:red; cursor:pointer; margin-left:auto;">ဖျက်ရန်</span>` : ''}
            </div>
        </div>`).join('');
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
    if (c[f].includes(uid)) {
        c[f] = c[f].filter(x => x !== uid);
        c[cf] = Math.max(0, (c[cf] || 0) - 1);
    } else {
        c[f].push(uid);
        c[cf] = (c[cf] || 0) + 1;
    }
    await ref.update({ comments });
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
async function handleShare(id) { await db.collection("health_posts").doc(id).update({ shares: firebase.firestore.FieldValue.increment(1) }); alert("Shared!"); }

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
