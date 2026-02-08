// --- ၁။ Firebase Config & Init ---
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

// --- ၂။ Auth State (User Login/Logout စစ်ဆေးခြင်း) ---
auth.onAuthStateChanged(user => {
    const nameDisplay = document.getElementById('userNameDisplay');
    const adminBadge = document.getElementById('adminBadge');
    const googleBtn = document.getElementById('googleBtn');
    const phoneLoginBtn = document.getElementById('phoneLoginBtn');
    const ratingInputBox = document.getElementById('ratingInputBox');
    const nameModal = document.getElementById('nameSetupModal');

    if (user) {
        // နာမည်မရှိလျှင် Popup ပြမည်
        if (!user.displayName) {
            if (nameModal) nameModal.style.display = 'flex';
        } else {
            if (nameModal) nameModal.style.display = 'none';
            if (nameDisplay) nameDisplay.innerText = user.displayName;
        }

        // UI ပြင်ဆင်ခြင်း
        if (googleBtn) googleBtn.style.display = 'none';
        if (phoneLoginBtn) phoneLoginBtn.style.display = 'none';
        if (ratingInputBox) ratingInputBox.style.display = 'block';

        // Admin စစ်ဆေးခြင်း
        if (user.email === ADMIN_EMAIL) {
            if (adminBadge) adminBadge.style.display = 'inline-block';
            if (typeof loadFeedbacksForAdmin === 'function') loadFeedbacksForAdmin();
        }
    } else {
        // Guest အနေအထား
        if (nameDisplay) nameDisplay.innerText = "ဧည့်သည် (Guest)";
        if (googleBtn) googleBtn.style.display = 'block';
        if (phoneLoginBtn) phoneLoginBtn.style.display = 'block';
        if (ratingInputBox) ratingInputBox.style.display = 'none';
        if (adminBadge) adminBadge.style.display = 'none';
        if (nameModal) nameModal.style.display = 'none';
    }

    if (!window.postsLoaded) {
        loadPosts();
        listenToRatings();
        window.postsLoaded = true;
    }
});

// --- ၃။ နာမည်သိမ်းဆည်းခြင်း Function ---
async function saveInitialName() {
    const nameInput = document.getElementById('setupUserName').value.trim();
    const btn = document.getElementById('saveNameBtn');
    const currentUser = auth.currentUser;

    if (!nameInput) return alert("ကျေးဇူးပြု၍ အမည်တစ်ခုခု ရိုက်ထည့်ပါ");
    if (!currentUser) return;

    btn.disabled = true;
    btn.innerText = "သိမ်းနေသည်...";

    try {
        await currentUser.updateProfile({ displayName: nameInput });
        
        await db.collection("users").doc(currentUser.uid).set({
            displayName: nameInput,
            phoneNumber: currentUser.phoneNumber || "",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        alert("အတည်ပြုပြီးပါပြီ။");
        location.reload(); 
    } catch (error) {
        console.error(error);
        alert("အမှားတစ်ခုဖြစ်သွားပါသည်။ Firebase Rules ကို ပြန်စစ်ပေးပါ။");
        btn.disabled = false;
        btn.innerText = "အတည်ပြုမည်";
    }
}

// --- ၄။ Login & Media Functions ---
async function loginWithGoogle() { try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); } catch (e) { alert(e.message); } }
window.onload = () => { window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { 'size': 'invisible' }); };
function showPhoneLogin() { document.getElementById('phoneLoginModal').style.display = 'block'; }
function closePhoneLogin() { document.getElementById('phoneLoginModal').style.display = 'none'; }
async function sendOTP() {
    let num = document.getElementById('phoneNumber').value.trim().replace(/^0/, '');
    try {
        window.confirmationResult = await auth.signInWithPhoneNumber("+95" + num, window.recaptchaVerifier);
        document.getElementById('otpSection').style.display = 'block';
        alert("OTP ပို့ပြီးပါပြီ");
    } catch (e) { alert(e.message); }
}
async function verifyOTP() {
    try { await window.confirmationResult.confirm(document.getElementById('otpCode').value); closePhoneLogin(); } catch (e) { alert("OTP မှားသည်"); }
}
function checkLogin() { if (!auth.currentUser) { alert("Login အရင်ဝင်ပါ"); return false; } return true; }

function previewMedia(input) {
    const box = document.getElementById('mediaPreviewBox');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            box.style.display = 'block';
            box.innerHTML = input.files[0].type.startsWith('video') ? `<video src="${e.target.result}" style="width:100px;" muted></video>` : `<img src="${e.target.result}" style="width:100px;">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// --- ၅။ Post & Load Posts Logic ---
function loadPosts() {
    db.collection("health_posts").orderBy("createdAt", "desc").onSnapshot(snap => {
        const feed = document.getElementById('newsFeed');
        if (!feed) return;
        const uid = auth.currentUser ? auth.currentUser.uid : "visitor";
        const isAdmin = auth.currentUser && auth.currentUser.email === ADMIN_EMAIL;

        snap.docChanges().forEach(change => {
            const d = change.doc.data();
            const id = change.doc.id;
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
                updatePostUI(id, d, uid, isAdmin);
            } 
            else if (change.type === "removed" && postEl) {
                postEl.remove();
            }
        });
    });
}

function renderPostHTML(id, d, uid, isAdmin) {
    const isLiked = (d.likedBy || []).includes(uid);
    const isHahaed = (d.hahaedBy || []).includes(uid);
    return `
        <div style="float:right;">
            ${isAdmin ? `<button onclick="togglePin('${id}', ${d.isPinned||false})" style="color:orange; border:none; background:none;">${d.isPinned?'📌':'📍'}</button>` : ''}
            ${isAdmin ? `<button onclick="deletePost('${id}')" style="color:red; border:none; background:none;">🗑️</button>` : ''}
        </div>
        <b style="color:purple;">${d.author}</b>
        <p style="margin:10px 0; white-space:pre-wrap;">${d.text || ""}</p>
        <div id="media-container-${id}">
            ${d.mediaUrl ? (d.mediaType === 'video' ? `<video controls style="width:100%; border-radius:8px;"><source src="${d.mediaUrl}"></video>` : `<img src="${d.mediaUrl}" style="width:100%; border-radius:8px;">`) : ''}
        </div>
        <div style="display:flex; gap:20px; margin-top:10px; border-top:1px solid #eee; padding-top:10px;" id="react-bar-${id}">
            <span onclick="handleReact('${id}', 'likes')" style="cursor:pointer; font-weight:bold; color:${isLiked?'blue':'gray'}">👍 Like (${d.likes || 0})</span>
            <span onclick="handleReact('${id}', 'hahas')" style="cursor:pointer; font-weight:bold; color:${isHahaed?'orange':'gray'}">😆 Haha (${d.hahas || 0})</span>
        </div>
        <div style="margin-top:10px;">
            <div id="comms-${id}">${renderComments(id, d.comments, isAdmin, uid)}</div>
            <div style="display:flex; gap:5px; margin-top:8px;">
                <input type="text" id="in-${id}" placeholder="မှတ်ချက်..." style="flex:1; border:1px solid #ddd; border-radius:15px; padding:5px 12px;">
                <button onclick="addComment('${id}')" style="color:purple; border:none; background:none; font-weight:bold;">Send</button>
            </div>
        </div>`;
}

function updatePostUI(id, d, uid, isAdmin) {
    const isLiked = (d.likedBy || []).includes(uid);
    const isHahaed = (d.hahaedBy || []).includes(uid);
    const reactBar = document.getElementById(`react-bar-${id}`);
    if (reactBar) {
        reactBar.innerHTML = `
            <span onclick="handleReact('${id}', 'likes')" style="cursor:pointer; font-weight:bold; color:${isLiked?'blue':'gray'}">👍 Like (${d.likes || 0})</span>
            <span onclick="handleReact('${id}', 'hahas')" style="cursor:pointer; font-weight:bold; color:${isHahaed?'orange':'gray'}">😆 Haha (${d.hahas || 0})</span>`;
    }
    const commsSection = document.getElementById(`comms-${id}`);
    if (commsSection) commsSection.innerHTML = renderComments(id, d.comments, isAdmin, uid);
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

// --- ၆။ Reactions & Post Actions ---
async function handleReact(id, type) {
    if (!checkLogin()) return;
    const ref = db.collection("health_posts").doc(id);
    const snap = await ref.get();
    const d = snap.data();
    const uid = auth.currentUser.uid;
    const field = type==='likes'?'likedBy':'hahaedBy';
    const countField = type==='likes'?'likes':'hahas';
    if ((d[field] || []).includes(uid)) {
        await ref.update({ [field]: firebase.firestore.FieldValue.arrayRemove(uid), [countField]: firebase.firestore.FieldValue.increment(-1) });
    } else {
        await ref.update({ [field]: firebase.firestore.FieldValue.arrayUnion(uid), [countField]: firebase.firestore.FieldValue.increment(1) });
    }
}

async function addComment(id) {
    if (!checkLogin()) return;
    const el = document.getElementById(`in-${id}`);
    if (!el.value.trim()) return;
    await db.collection("health_posts").doc(id).update({
        comments: firebase.firestore.FieldValue.arrayUnion({
            author: auth.currentUser.displayName || "User",
            text: el.value, likes: 0, hahas: 0, likedBy: [], hahaedBy: [], createdAt: Date.now()
        })
    });
    el.value = "";
}

async function uploadAndPost() {
    if (!checkLogin()) return;
    const text = document.getElementById('postContent').value.trim();
    const file = document.getElementById('mediaInput').files[0];
    const btn = document.getElementById('btnPost');
    
    if (file && file.size > 20 * 1024 * 1024) return alert("ဖိုင်ဆိုဒ် 20MB အောက်သာ တင်ပေးပါ။");
    if (!text && !file) return;

    btn.disabled = true; btn.innerText = "...";
    try {
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
            text, mediaUrl, mediaType, likes:0, hahas:0, likedBy:[], hahaedBy:[], comments:[], isPinned:false, createdAt: Date.now()
        });
        document.getElementById('postContent').value = "";
        document.getElementById('mediaPreviewBox').innerHTML = "";
    } catch (e) { alert(e.message); }
    btn.disabled = false; btn.innerText = "တင်မည်";
}

async function togglePin(id, current) { await db.collection("health_posts").doc(id).update({ isPinned: !current }); }
async function deletePost(id) { if(confirm("ဖျက်မှာလား?")) await db.collection("health_posts").doc(id).delete(); }
async function deleteComment(postId, index) {
    const ref = db.collection("health_posts").doc(postId);
    const snap = await ref.get();
    let comments = snap.data().comments || [];
    comments.splice(index, 1);
    await ref.update({ comments });
}

// --- ၇။ Rating & Feedback Logic ---
let selectedRating = 0;
function setRating(stars) {
    selectedRating = stars;
    for (let i = 1; i <= 5; i++) {
        const star = document.getElementById(`star-${i}`);
        if (star) star.style.color = i <= stars ? "gold" : "gray";
    }
}

async function submitFeedback() {
    if (!checkLogin()) return;
    const text = document.getElementById('feedbackText').value.trim();
    if (selectedRating === 0 || !text) return alert("Rating နှင့် မှတ်ချက် အပြည့်အစုံ ဖြည့်ပေးပါ");
    
    const btn = document.getElementById('submitFeedbackBtn');
    btn.disabled = true; btn.innerText = "တင်နေသည်...";

    try {
        await db.collection("app_feedback").add({
            uid: auth.currentUser.uid,
            userName: auth.currentUser.displayName || "User",
            rating: selectedRating,
            feedback: text,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("ကျေးဇူးတင်ပါသည်။");
        document.getElementById('feedbackText').value = "";
        setRating(0);
    } catch (e) { alert(e.message); }
    btn.disabled = false; btn.innerText = "Rating ပေးမည်";
}

function listenToRatings() {
    db.collection("app_feedback").onSnapshot(snap => {
        let totalStars = 0, count = snap.size, dist = {1:0, 2:0, 3:0, 4:0, 5:0};
        snap.forEach(doc => {
            const r = doc.data().rating;
            if (dist[r] !== undefined) { dist[r]++; totalStars += r; }
        });
        document.getElementById('averageRatingDisplay').innerText = `⭐ ${count > 0 ? (totalStars / count).toFixed(1) : "0.0"}`;
        for (let i = 1; i <= 5; i++) document.getElementById(`c${i}`).innerText = dist[i];
    });
}
// ဗီဒီယိုများကို Screen ပေါ်မှာ ရှိမရှိ စောင့်ကြည့်မည့် စနစ်
const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const video = entry.target;
        
        // အကယ်၍ ဗီဒီယိုက Screen ပေါ်မှာ ၅၀% အောက်ပဲ မြင်ရတော့ရင် ရပ်ပစ်မည်
        if (!entry.isIntersecting || entry.intersectionRatio < 0.5) {
            video.pause();
        }
    });
}, { threshold: [0, 0.5] }); // ၀% နှင့် ၅၀% မြင်ရမှုကို စစ်ဆေးမည်

// ပို့စ်အသစ်တွေတက်လာတိုင်း ဗီဒီယိုတွေကို စောင့်ကြည့်ခိုင်းရန်
function observeVideos() {
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(v => videoObserver.observe(v));
}

// ဤ function ကို loadPosts ထဲက snapshot အပြောင်းအလဲဖြစ်တိုင်း ခေါ်ပေးရပါမည်

async function reactComment(postId, index, type) {
    if (!checkLogin()) return;
    
    const ref = db.collection("health_posts").doc(postId);
    const snap = await ref.get();
    
    if (!snap.exists) return;

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
