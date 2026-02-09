// --- ၀။ Fingerprint Helper (Device ID ယူရန်) ---
async function getMyDeviceId() {
    try {
        if (typeof FingerprintJS === 'undefined') return "unknown";
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        return result.visitorId;
    } catch (e) { return "error_id"; }
}

// --- ၁။ Firebase Init & Config ---
const firebaseConfig = {
    apiKey: "AIzaSyD4Yiez3VXKD90za0wnt03lFPjeln4su7U",
    authDomain: "hospital-app-caf85.firebaseapp.com",
    projectId: "hospital-app-caf85",
    storageBucket: "hospital-app-caf85.firebasestorage.app",
    messagingSenderId: "736486429191",
    appId: "1:736486429191:web:25c116beb3994d213cd0a2"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const ADMIN_EMAIL = "uwinkyawdevelopbusinessco@gmail.com"; 
const IMGBB_KEY = "C8d8d00185e973ebcafddd34f77a1176"; 
const BUNNY_KEY = "a038d7e1-bf94-448b-b863c156422e-7e4a-4299"; 
const BUNNY_STORAGE = "public-hospitals";

// --- ၂။ Video Observer (Auto-pause system) ---
const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const video = entry.target;
        if (!entry.isIntersecting || entry.intersectionRatio < 0.8) {
            video.pause();
        }
    });
}, { threshold: [0, 0.8] });

function observeVideos() {
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(v => videoObserver.observe(v));
}

// --- ၃။ Auth State Management ---
auth.onAuthStateChanged(user => {
    const nameDisplay = document.getElementById('userNameDisplay');
    const nameModal = document.getElementById('nameSetupModal');
    const adminBadge = document.getElementById('adminBadge');

    if (user) {
        if (!user.displayName) {
            if (nameModal) nameModal.style.display = 'flex';
        } else {
            if (nameModal) nameModal.style.display = 'none';
            if (nameDisplay) nameDisplay.innerText = user.displayName;
        }
        document.getElementById('googleBtn').style.display = 'none';
        document.getElementById('phoneLoginBtn').style.display = 'none';
        document.getElementById('ratingInputBox').style.display = 'block';
        if (user.email === ADMIN_EMAIL && adminBadge) adminBadge.style.display = 'inline-block';
    } else {
        if (nameDisplay) nameDisplay.innerText = "ဧည့်သည် (Guest)";
        document.getElementById('googleBtn').style.display = 'block';
        document.getElementById('phoneLoginBtn').style.display = 'block';
        document.getElementById('ratingInputBox').style.display = 'none';
    }

    if (!window.postsLoaded) {
        loadPosts();
        listenToRatings();
        window.postsLoaded = true;
    }
});

// --- ၄။ Core Features (Post, Share, React) ---

async function uploadAndPost() {
    if (!checkLogin()) return;
    const text = document.getElementById('postContent').value.trim();
    const file = document.getElementById('mediaInput').files[0];
    const btn = document.getElementById('btnPost');
    
    if (file && file.size > 20 * 1024 * 1024) return alert("ဖိုင်ဆိုဒ် 20MB အောက်သာ တင်ပေးပါ။");
    if (!text && !file) return;

    btn.disabled = true; btn.innerText = "...";
    try {
        const deviceId = await getMyDeviceId();
        let mediaUrl = "", mediaType = "none";
        
        if (file) {
            const fileName = Date.now() + "_" + file.name.replace(/\s+/g, "_");
            if (file.type.startsWith("video")) {
                await fetch(`https://sg.storage.bunnycdn.com/${BUNNY_STORAGE}/${fileName}`, { method: "PUT", headers: { "AccessKey": BUNNY_KEY }, body: file });
                mediaUrl = `https://public-hospitals.b-cdn.net/${fileName}`; mediaType = "video";
            } else {
                const fd = new FormData(); fd.append("image", file);
                const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: fd });
                const d = await res.json(); mediaUrl = d.data.url; mediaType = "image";
            }
        }

        await db.collection("health_posts").add({
            author: auth.currentUser.displayName || "User",
            uid: auth.currentUser.uid,
            deviceId: deviceId, 
            text, mediaUrl, mediaType,
            likes: 0, hahas: 0, shares: 0,
            likedBy: [], hahaedBy: [], comments: [],
            isPinned: false, createdAt: Date.now()
        });
        
        document.getElementById('postContent').value = "";
        document.getElementById('mediaInput').value = "";
        document.getElementById('mediaPreviewBox').innerHTML = "";
    } catch (e) { alert(e.message); }
    btn.disabled = false; btn.innerText = "တင်မည်";
}

async function handleShare(id) {
    if (!checkLogin()) return;
    try {
        await db.collection("health_posts").doc(id).update({
            shares: firebase.firestore.FieldValue.increment(1)
        });
        alert("🚀 Share လုပ်ပြီးပါပြီ!");
    } catch (e) { alert("Share လုပ်၍ မရပါ"); }
}

async function handleReact(id, type) {
    if (!checkLogin()) return;
    const ref = db.collection("health_posts").doc(id);
    const snap = await ref.get();
    const d = snap.data();
    const uid = auth.currentUser.uid;
    const field = type === 'likes' ? 'likedBy' : 'hahaedBy';
    const countField = type === 'likes' ? 'likes' : 'hahas';

    if ((d[field] || []).includes(uid)) {
        await ref.update({ [field]: firebase.firestore.FieldValue.arrayRemove(uid), [countField]: firebase.firestore.FieldValue.increment(-1) });
    } else {
        await ref.update({ [field]: firebase.firestore.FieldValue.arrayUnion(uid), [countField]: firebase.firestore.FieldValue.increment(1) });
    }
}

// --- ၅။ Rendering Logic ---

function loadPosts() {
    db.collection("health_posts").orderBy("createdAt", "desc").onSnapshot(snap => {
        const feed = document.getElementById('newsFeed');
        if (!feed) return;
        const uid = auth.currentUser ? auth.currentUser.uid : "visitor";
        const isAdmin = auth.currentUser && auth.currentUser.email === ADMIN_EMAIL;

        snap.docChanges().forEach(change => {
            const id = change.doc.id;
            const d = change.doc.data();
            const postEl = document.getElementById(`post-${id}`);

            if (change.type === "added" && !postEl) {
                const div = document.createElement('div');
                div.id = `post-${id}`;
                div.className = "post-card";
                div.style = `background:white; margin-bottom:15px; padding:15px; border-radius:12px; border:${d.isPinned?'2px solid orange':'none'}; text-align:left; color:black;`;
                div.innerHTML = renderPostHTML(id, d, uid, isAdmin);
                if (d.isPinned) feed.prepend(div); else feed.appendChild(div);
            } 
            else if (change.type === "modified" && postEl) {
                postEl.innerHTML = renderPostHTML(id, d, uid, isAdmin);
            } 
            else if (change.type === "removed" && postEl) {
                postEl.remove();
            }
        });
        setTimeout(observeVideos, 500);
    });
}

function renderPostHTML(id, d, uid, isAdmin) {
    const isLiked = (d.likedBy || []).includes(uid);
    const isHahaed = (d.hahaedBy || []).includes(uid);
    return `
        <div style="float:right;">
            ${isAdmin ? `<button onclick="togglePin('${id}', ${d.isPinned})">📌</button>` : ''}
            ${isAdmin ? `<button onclick="deletePost('${id}')">🗑️</button>` : ''}
        </div>
        <b style="color:purple;">${d.author}</b>
        <p style="margin:10px 0; white-space:pre-wrap;">${d.text || ""}</p>
        ${d.mediaUrl ? (d.mediaType === 'video' ? `<video controls style="width:100%; border-radius:8px;"><source src="${d.mediaUrl}"></video>` : `<img src="${d.mediaUrl}" style="width:100%; border-radius:8px;">`) : ''}
        <div style="display:flex; gap:15px; margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
            <span onclick="handleReact('${id}', 'likes')" style="cursor:pointer; font-weight:bold; color:${isLiked?'blue':'gray'}">👍 Like (${d.likes || 0})</span>
            <span onclick="handleReact('${id}', 'hahas')" style="cursor:pointer; font-weight:bold; color:${isHahaed?'orange':'gray'}">😆 Haha (${d.hahas || 0})</span>
            <span onclick="handleShare('${id}')" style="cursor:pointer; font-weight:bold; color:purple">🚀 Share (${d.shares || 0})</span>
        </div>
        <div style="margin-top:10px;">
            <div id="comms-${id}">${renderComments(id, d.comments, isAdmin, uid)}</div>
            <div style="display:flex; gap:5px; margin-top:8px;">
                <input type="text" id="in-${id}" placeholder="မှတ်ချက်..." style="flex:1; border-radius:15px; border:1px solid #ddd; padding:5px 12px;">
                <button onclick="addComment('${id}')" style="color:purple; border:none; background:none; font-weight:bold;">Send</button>
            </div>
        </div>`;
}

function renderComments(id, comments, isAdmin, uid) {
    return (comments || []).map((c, i) => `
        <div style="background:#f0f2f5; margin-bottom:8px; padding:8px; border-radius:8px; font-size:13px; position:relative;">
            <b>${c.author}</b>: ${c.text}
            ${isAdmin ? `<span onclick="deleteComment('${id}', ${i})" style="position:absolute; right:5px; color:red; cursor:pointer;">×</span>` : ''}
            <div style="font-size:11px; margin-top:4px;">
                <span onclick="reactComment('${id}', ${i}, 'likes')" style="cursor:pointer; color:${(c.likedBy||[]).includes(uid)?'blue':'gray'}">👍 ${c.likes||0}</span> &nbsp;
                <span onclick="reactComment('${id}', ${i}, 'hahas')" style="cursor:pointer; color:${(c.hahaedBy||[]).includes(uid)?'orange':'gray'}">😆 ${c.hahas||0}</span>
            </div>
        </div>`).join('');
}

// --- ၆။ အခြား Function များ (Rating, Delete, OTP) ---
async function submitFeedback() {
    if (!checkLogin()) return;
    const text = document.getElementById('feedbackText').value.trim();
    if (selectedRating === 0 || !text) return alert("Rating နှင့် မှတ်ချက် အပြည့်အစုံ ဖြည့်ပေးပါ");
    const deviceId = await getMyDeviceId();
    try {
        await db.collection("app_feedback").add({
            uid: auth.currentUser.uid, userName: auth.currentUser.displayName,
            rating: selectedRating, feedback: text, deviceId: deviceId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("ကျေးဇူးတင်ပါသည်။");
        document.getElementById('feedbackText').value = "";
    } catch (e) { alert(e.message); }
}

async function addComment(id) {
    if (!checkLogin()) return;
    const el = document.getElementById(`in-${id}`);
    if (!el.value.trim()) return;
    const deviceId = await getMyDeviceId();
    await db.collection("health_posts").doc(id).update({
        comments: firebase.firestore.FieldValue.arrayUnion({
            author: auth.currentUser.displayName || "User",
            text: el.value, deviceId: deviceId, likes: 0, hahas: 0, likedBy: [], hahaedBy: [], createdAt: Date.now()
        })
    });
    el.value = "";
}

// Login & Utils
async function loginWithGoogle() { try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); } catch (e) { alert(e.message); } }
function checkLogin() { if (!auth.currentUser) { alert("Login အရင်ဝင်ပါ"); return false; } return true; }
async function togglePin(id, current) { await db.collection("health_posts").doc(id).update({ isPinned: !current }); }
async function deletePost(id) { if(confirm("ဖျက်မှာလား?")) await db.collection("health_posts").doc(id).delete(); }
// --- Comment React Function (Array Update Logic) ---
async function reactComment(postId, index, type) {
    if (!checkLogin()) return;
    
    const ref = db.collection("health_posts").doc(postId);
    const snap = await ref.get();
    
    if (!snap.exists) return;

    // လက်ရှိ Post ထဲက Comments တွေကို copy ယူမယ်
    let comments = [...snap.data().comments];
    let c = comments[index];
    const uid = auth.currentUser.uid;
    
    const field = type === 'likes' ? 'likedBy' : 'hahaedBy';
    const countField = type === 'likes' ? 'likes' : 'hahas';

    // Array မရှိသေးရင် အသစ်တည်ဆောက်ပေးရန်
    if (!c[field]) c[field] = [];
    if (!c[countField]) c[countField] = 0;

    if (c[field].includes(uid)) {
        // Reaction ပေးပြီးသားဆိုရင် ပြန်ဖြုတ်မယ်
        c[field] = c[field].filter(x => x !== uid);
        c[countField] = Math.max(0, c[countField] - 1);
    } else {
        // Reaction အသစ်ပေးမယ်
        c[field].push(uid);
        c[countField] = (c[countField] || 0) + 1;
    }

    // Database ထဲမှာ တစ်ခုလုံးကို ပြန် Update လုပ်မယ်
    await ref.update({ comments });
}
