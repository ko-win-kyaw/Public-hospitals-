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

// --- ၂။ Auth State (Login နေရာ ပျောက်ပျောက်သွားတာကို ဖြေရှင်းထားသည်) ---
auth.onAuthStateChanged(user => {
    const nameDisplay = document.getElementById('userNameDisplay');
    const adminBadge = document.getElementById('adminBadge');
    const googleBtn = document.getElementById('googleBtn');
    const phoneLoginBtn = document.getElementById('phoneLoginBtn');
    const ratingInputBox = document.getElementById('ratingInputBox');

    // Default အနေနဲ့ အားလုံးကို ဖျောက်ထားပြီးမှ User ရှိမရှိပေါ်မူတည်ပြီး ပြန်ပြပါ
    if (googleBtn) googleBtn.style.display = 'none';
    if (phoneLoginBtn) phoneLoginBtn.style.display = 'none';

    if (user) {
        if(nameDisplay) nameDisplay.innerText = user.displayName || user.phoneNumber || user.email || "User";
        if(ratingInputBox) ratingInputBox.style.display = 'block';
        if (user.email === ADMIN_EMAIL && adminBadge) adminBadge.style.display = 'inline-block';
    } else {
        if(nameDisplay) nameDisplay.innerText = "ဧည့်သည် (Guest)";
        if(googleBtn) googleBtn.style.display = 'block';
        if(phoneLoginBtn) phoneLoginBtn.style.display = 'block';
        if(ratingInputBox) ratingInputBox.style.display = 'none';
        if(adminBadge) adminBadge.style.display = 'none';
    }
    // ပထမအကြိမ်ပဲ Load လုပ်ပါ၊ onSnapshot က ကျန်တာ တာဝန်ယူပါလိမ့်မည်
    if (!window.postsLoaded) {
        loadPosts();
        window.postsLoaded = true;
    }
});
// အပိုင်း (၂) ရဲ့ if (user) အောက်မှာ ဒါကို ထည့်ပါ
if (user.email === ADMIN_EMAIL) {
    if (adminBadge) adminBadge.style.display = 'inline-block';
    loadFeedbacksForAdmin(); // ဒီ Line ကို ထည့်ပေးပါ
}

// --- ၃။ Login & Media (နဂိုအတိုင်း) ---
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

// --- ၄။ Real-time Load Posts (ဗီဒီယိုမရပ်စေရန်နှင့် မျက်နှာပြင်ငြိမ်စေရန် ပြင်ဆင်မှု) ---
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
                // ပို့စ်အသစ်ဖြစ်ပါက အပေါ်ဆုံးမှ ပေါင်းထည့်ပါ
                const div = document.createElement('div');
                div.id = `post-${id}`;
                div.className = "post-card";
                div.style = `background:white; margin-bottom:15px; padding:15px; border-radius:12px; border:${d.isPinned?'2px solid orange':'none'}; text-align:left; color:black;`;
                div.innerHTML = renderPostHTML(id, d, uid, isAdmin);
                
                if (d.isPinned) feed.prepend(div); // Pin ထားရင် အပေါ်ဆုံးပို့
                else feed.appendChild(div);
            } 
            else if (change.type === "modified" && postEl) {
                // Like သို့မဟုတ် Comment ပြောင်းလဲပါက ဗီဒီယို Player ကို မထိခိုက်ဘဲ စာသားများကိုသာ Update လုပ်ပါ
                updatePostUI(id, d, uid, isAdmin);
            } 
            else if (change.type === "removed" && postEl) {
                postEl.remove();
            }
        });
    });
}

// ပို့စ်တစ်ခုချင်းစီ၏ HTML ကို တည်ဆောက်ပေးသော Function
function renderPostHTML(id, d, uid, isAdmin) {
    const isLiked = (d.likedBy || []).includes(uid);
    const isHahaed = (d.hahaedBy || []).includes(uid);
    const comms = renderComments(id, d.comments, isAdmin, uid);

    return `
        <div style="float:right;">
            ${isAdmin ? `<button onclick="togglePin('${id}', ${d.isPinned||false})" style="color:orange; border:none; background:none; cursor:pointer;">${d.isPinned?'📌':'📍'}</button>` : ''}
            ${isAdmin ? `<button onclick="deletePost('${id}')" style="color:red; border:none; background:none; cursor:pointer;">🗑️</button>` : ''}
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
            <div id="comms-${id}">${comms}</div>
            <div style="display:flex; gap:5px; margin-top:8px;">
                <input type="text" id="in-${id}" placeholder="မှတ်ချက်..." style="flex:1; border:1px solid #ddd; border-radius:15px; padding:5px 12px;">
                <button onclick="addComment('${id}')" style="color:purple; border:none; background:none; font-weight:bold; cursor:pointer;">Send</button>
            </div>
        </div>`;
}

// ဗီဒီယို Player ကို Reset မဖြစ်စေဘဲ Reaction နှင့် Comment သာ Update လုပ်သော Function
function updatePostUI(id, d, uid, isAdmin) {
    const isLiked = (d.likedBy || []).includes(uid);
    const isHahaed = (d.hahaedBy || []).includes(uid);
    // --- uploadAndPost function ထဲတွင် ဤသို့ပြင်ပါ ---
async function uploadAndPost() {
    if (!checkLogin()) return;
    const text = document.getElementById('postContent').value.trim();
    const file = document.getElementById('mediaInput').files[0];
    const btn = document.getElementById('btnPost');

    // --- File Size ကန့်သတ်ချက် ထည့်ခြင်း (20MB = 20 * 1024 * 1024 bytes) ---
    if (file) {
        const maxSize = 20 * 1024 * 1024; // 20MB
        if (file.size > maxSize) {
            alert("ဖိုင်ဆိုဒ် အရမ်းကြီးနေပါသည်။ 20MB အောက်သာ တင်ပေးပါ။");
            return;
        }
    }
    // ------------------------------------------

    if (!text && !file) return;
    // ... ကျန်တဲ့ Code များ (နဂိုအတိုင်း) ...
}

    // Reaction Bar ကိုသာ Update လုပ်ပါ
    const reactBar = document.getElementById(`react-bar-${id}`);
    if (reactBar) {
        reactBar.innerHTML = `
            <span onclick="handleReact('${id}', 'likes')" style="cursor:pointer; font-weight:bold; color:${isLiked?'blue':'gray'}">👍 Like (${d.likes || 0})</span>
            <span onclick="handleReact('${id}', 'hahas')" style="cursor:pointer; font-weight:bold; color:${isHahaed?'orange':'gray'}">😆 Haha (${d.hahas || 0})</span>`;
    }

    // Comment Section ကိုသာ Update လုပ်ပါ
    const commsSection = document.getElementById(`comms-${id}`);
    if (commsSection) {
        commsSection.innerHTML = renderComments(id, d.comments, isAdmin, uid);
    }
}

function renderComments(id, comments, isAdmin, uid) {
    return (comments || []).map((c, i) => `
        <div style="background:#f0f2f5; margin-bottom:8px; padding:8px; border-radius:8px; font-size:13px; position:relative;">
            <b>${c.author}</b>: ${c.text}
            ${isAdmin ? `<span onclick="deleteComment('${id}', ${i})" style="position:absolute; right:5px; color:red; cursor:pointer; font-weight:bold;">×</span>` : ''}
            <div style="font-size:11px; margin-top:4px;">
                <span onclick="reactComment('${id}', ${i}, 'likes')" style="cursor:pointer; color:${(c.likedBy||[]).includes(uid)?'blue':'gray'}">👍 ${c.likes||0}</span> &nbsp;
                <span onclick="reactComment('${id}', ${i}, 'hahas')" style="cursor:pointer; color:${(c.hahaedBy||[]).includes(uid)?'orange':'gray'}">😆 ${c.hahas||0}</span>
            </div>
        </div>`).join('');
}


// --- ၅။ Actions (နဂိုအတိုင်း) ---
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

async function reactComment(postId, index, type) {
    if (!checkLogin()) return;
    const ref = db.collection("health_posts").doc(postId);
    const snap = await ref.get();
    let comments = [...snap.data().comments];
    let c = comments[index];
    const uid = auth.currentUser.uid;
    const field = type==='likes'?'likedBy':'hahaedBy';
    const count = type==='likes'?'likes':'hahas';
    if (!c[field]) c[field] = [];
    if (c[field].includes(uid)) {
        c[field] = c[field].filter(x => x !== uid);
        c[count] = Math.max(0, (c[count] || 1) - 1);
    } else {
        c[field].push(uid);
        c[count] = (c[count] || 0) + 1;
    }
    await ref.update({ comments });
}

async function addComment(id) {
    if (!checkLogin()) return;
    const el = document.getElementById(`in-${id}`);
    if (!el.value.trim()) return;
    await db.collection("health_posts").doc(id).update({
        comments: firebase.firestore.FieldValue.arrayUnion({
            author: auth.currentUser.displayName || auth.currentUser.phoneNumber || "User",
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
            author: auth.currentUser.displayName || auth.currentUser.phoneNumber || "User",
            text, mediaUrl, mediaType, likes:0, hahas:0, likedBy:[], hahaedBy:[], comments:[], isPinned:false, createdAt: Date.now()
        });
        document.getElementById('postContent').value = "";
        document.getElementById('mediaPreviewBox').innerHTML = "";
    } catch (e) { alert(e.message); }
    btn.disabled = false; btn.innerText = "Post";
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

// ကြယ်ပွင့်ရွေးချယ်မှုကို UI မှာပြသရန်
function setRating(stars) {
    selectedRating = stars;
    // UI ရှိ star icon များကို အရောင်ပြောင်းရန် (HTML မှာ class ရှိရပါမည်)
    for (let i = 1; i <= 5; i++) {
        const star = document.getElementById(`star-${i}`);
        if (star) {
            star.style.color = i <= stars ? "gold" : "gray";
        }
    }
}

// Feedback ကို Database ထဲသို့ သိမ်းဆည်းရန်
async function submitFeedback() {
    if (!checkLogin()) return; // Login ဝင်ထားမှ ပေးလို့ရမည်

    const feedbackText = document.getElementById('feedbackText').value.trim();
    const btn = document.getElementById('submitFeedbackBtn');

    if (selectedRating === 0) return alert("ကျေးဇူးပြု၍ ကြယ်ပွင့်အရေအတွက် ရွေးချယ်ပေးပါ");
    if (!feedbackText) return alert("ကျေးဇူးပြု၍ မှတ်ချက်တစ်ခုခု ရေးပေးပါ");

    btn.disabled = true;
    btn.innerText = "တင်နေသည်...";

    try {
        await db.collection("app_feedback").add({
            uid: auth.currentUser.uid,
            userName: auth.currentUser.displayName || auth.currentUser.phoneNumber || "User",
            rating: selectedRating,
            feedback: feedbackText,
            createdAt: firebase.firestore.FieldValue.serverTimestamp() // Server အချိန်အတိုင်းသိမ်းမည်
        });

        alert("သင်၏ အကြံပြုချက်အတွက် ကျေးဇူးတင်ပါသည်။");
        
        // Form ကို Reset ပြန်လုပ်ခြင်း
        document.getElementById('feedbackText').value = "";
        setRating(0); 

    } catch (error) {
        console.error("Error adding feedback: ", error);
        alert("အမှားတစ်ခု ဖြစ်သွားပါသည်၊ ခဏနေမှ ပြန်ကြိုးစားကြည့်ပါ။");
    } finally {
        btn.disabled = false;
        btn.innerText = "Submit Feedback";
    }
}
// --- ၈။ Real-time Rating Calculation ---
function listenToRatings() {
    db.collection("app_feedback").onSnapshot(snap => {
        let totalStars = 0;
        let count = snap.size;
        let distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        snap.forEach(doc => {
            const data = doc.data();
            const r = data.rating || 0;
            if (distribution[r] !== undefined) {
                distribution[r]++;
                totalStars += r;
            }
        });

        // ပျမ်းမျှ Rating တွက်ချက်ခြင်း (Average = Total Stars / Total Reviews)
        const average = count > 0 ? (totalStars / count).toFixed(1) : "0.0";

        // UI တွင် ပြသခြင်း
        const avgDisplay = document.getElementById('averageRatingDisplay');
        if (avgDisplay) avgDisplay.innerText = `⭐ ${average}`;

        // ကြယ်ပွင့်တစ်ခုချင်းစီ၏ အရေအတွက်ကို Update လုပ်ခြင်း
        for (let i = 1; i <= 5; i++) {
            const el = document.getElementById(`c${i}`);
            if (el) el.innerText = distribution[i];
        }

        // Rating Bar (Percentage) ကိုပါ လုပ်ချင်ရင် ဒီနေရာမှာ ထပ်တိုးနိုင်ပါတယ်
    });
}

// Auth State ပြောင်းလဲချိန် သို့မဟုတ် window.onload တွင် ဤ Function ကို ခေါ်ပေးရန် လိုအပ်သည်
// ဥပမာ - window.onload = () => { listenToRatings(); ... };
// script.js ရဲ့ အောက်ဆုံးမှာ ထည့်ပါ
listenToRatings(); 
// --- ၉။ Admin အတွက် Feedback များ ဖတ်ရန် Logic ---
function loadFeedbacksForAdmin() {
    // Admin ဟုတ်မဟုတ် စစ်ဆေးပြီးမှ ပြပါ
    if (!auth.currentUser || auth.currentUser.email !== ADMIN_EMAIL) {
        document.getElementById('adminFeedbackSection').style.display = 'none';
        return;
    }

    document.getElementById('adminFeedbackSection').style.display = 'block';

    db.collection("app_feedback").orderBy("createdAt", "desc").onSnapshot(snap => {
        const list = document.getElementById('feedbackList');
        if (!list) return;

        list.innerHTML = snap.docs.map(doc => {
            const d = doc.data();
            const date = d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleString() : "Just now";
            
            return `
                <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 10px; border-left: 5px solid purple; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content: space-between; font-size: 12px; color: gray;">
                        <b>${d.userName}</b>
                        <span>${date}</span>
                    </div>
                    <div style="color: orange; margin: 5px 0;">${'⭐'.repeat(d.rating)}</div>
                    <p style="margin: 0; font-size: 14px; color: #333;">${d.feedback}</p>
                </div>
            `;
        }).join('');
    });
}

