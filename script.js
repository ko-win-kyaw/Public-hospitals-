// ၁။ Configurations
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

let currentRating = 0;

// ၂။ Auth State & App Initialization
auth.onAuthStateChanged(user => {
    const nameDisplay = document.getElementById('userNameDisplay');
    const googleBtn = document.getElementById('googleBtn');
    const adminBadge = document.getElementById('adminBadge');
    const ratingBox = document.getElementById('ratingInputBox');

    if (user) {
        if(nameDisplay) nameDisplay.innerText = user.displayName || user.email;
        if(googleBtn) googleBtn.style.display = 'none';
        if(ratingBox) ratingBox.style.display = 'block';
        
        if (user.email === ADMIN_EMAIL && adminBadge) {
            adminBadge.style.display = 'inline-block';
        }
    } else {
        if(nameDisplay) nameDisplay.innerText = "ဧည့်သည် (Guest)";
        if(googleBtn) googleBtn.style.display = 'block';
    }
    startApp();
    loadRatings(); // Rating ကိန်းဂဏန်းများ ဆွဲတင်ရန်
});

async function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try { await auth.signInWithPopup(provider); } catch (e) { alert("Login Error: " + e.message); }
}

// ၃။ Rating စနစ် (Stars & Feedback)
function setRating(num) {
    currentRating = num;
    const stars = document.querySelectorAll('#ratingStars span');
    stars.forEach((s, i) => {
        s.style.color = i < num ? "orange" : "gray";
    });
}

async function submitFeedback() {
    if (!auth.currentUser) return alert("ဦးစွာ Login ဝင်ပေးပါ");
    if (currentRating === 0) return alert("Rating (ကြယ်ပွင့်) အရင်ရွေးပေးပါ");
    
    try {
        await db.collection("app_ratings").doc(auth.currentUser.uid).set({
            userName: auth.currentUser.displayName,
            rating: currentRating,
            feedback: document.getElementById('feedbackText').value,
            timestamp: Date.now()
        });
        alert("Rating ပေးပြီးပါပြီ။ ကျေးဇူးတင်ပါတယ်!");
    } catch (e) { alert(e.message); }
}

async function loadRatings() {
    db.collection("app_ratings").onSnapshot(snap => {
        let total = 0, counts = {1:0, 2:0, 3:0, 4:0, 5:0};
        snap.forEach(doc => {
            let r = doc.data().rating;
            counts[r]++;
            total += r;
        });
        let avg = snap.size > 0 ? (total / snap.size).toFixed(1) : "0.0";
        document.getElementById('averageRatingDisplay').innerText = "⭐ " + avg;
        for(let i=1; i<=5; i++) {
            const el = document.getElementById('c' + i);
            if(el) el.innerText = counts[i];
        }
    });
}

// ၄။ ပို့စ်တင်ခြင်း
async function uploadAndPost() {
    if (!auth.currentUser) return alert("ဦးစွာ Login ဝင်ပေးပါ");
    const text = document.getElementById('postContent').value.trim();
    const file = document.getElementById('mediaInput').files[0];
    const btn = document.getElementById('btnPost');

    btn.disabled = true;
    try {
        let mediaUrl = ""; let mediaType = "none";
        if (file) {
            const fileName = Date.now() + "_" + file.name.replace(/\s+/g, "_");
            if (file.type.startsWith("video")) {
                await fetch(`https://sg.storage.bunnycdn.com/${BUNNY_STORAGE}/${fileName}`, {
                    method: "PUT", headers: { "AccessKey": BUNNY_KEY }, body: file
                });
                mediaUrl = `https://public-hospitals.b-cdn.net/${fileName}`;
                mediaType = "video";
            } else {
                const fd = new FormData(); fd.append("image", file);
                const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: fd });
                const d = await res.json();
                mediaUrl = d.data.url; mediaType = "image";
            }
        }
        await db.collection("health_posts").add({
            author: auth.currentUser.displayName || "User",
            text, mediaUrl, mediaType,
            likes: 0, hahas: 0, likedBy: [], hahaedBy: [], comments: [],
            createdAt: Date.now()
        });
        document.getElementById('postContent').value = "";
        document.getElementById('mediaPreviewBox').style.display = "none";
        alert("ပို့စ်တင်ပြီးပါပြီ");
    } catch (e) { alert("Post Error: " + e.message); }
    btn.disabled = false;
}

// ၅။ News Feed & Reactions
function startApp() {
    db.collection("health_posts").orderBy("createdAt", "desc").onSnapshot(snap => {
        const feed = document.getElementById('newsFeed');
        if (!feed) return;
        let html = "";
        const isAdmin = auth.currentUser && auth.currentUser.email === ADMIN_EMAIL;
        const uid = auth.currentUser ? auth.currentUser.uid : "visitor";

        snap.forEach(doc => {
            const d = doc.data(); const id = doc.id;
            const isLiked = (d.likedBy || []).includes(uid);
            const isHahaed = (d.hahaedBy || []).includes(uid);

            let comms = (d.comments || []).map((c, i) => {
                const cLiked = (c.likedBy || []).includes(uid);
                const cHahaed = (c.hahaedBy || []).includes(uid);
                return `
                <div style="background:#f0f2f5; margin-bottom:8px; padding:10px; border-radius:10px; font-size:13px; color:black;">
                    <b>${c.author}</b>: ${c.text}
                    <div style="margin-top:5px; display:flex; gap:12px;">
                        <span onclick="reactComment('${id}', ${i}, 'likes')" style="cursor:pointer; color:${cLiked?'blue':'gray'}">👍 ${c.likes||0}</span>
                        <span onclick="reactComment('${id}', ${i}, 'hahas')" style="cursor:pointer; color:${cHahaed?'orange':'gray'}">😆 ${c.hahas||0}</span>
                    </div>
                </div>`;
            }).join('');

            html += `
                <div class="card" style="background:white; margin-bottom:15px; padding:15px; border-radius:12px; color:black; text-align:left; box-shadow:0 1px 3px rgba(0,0,0,0.1); position:relative;">
                    ${isAdmin ? `<button onclick="deletePost('${id}')" style="position:absolute; right:10px; top:10px; color:red; border:none; background:none; font-weight:bold; cursor:pointer;">[Delete]</button>` : ''}
                    <b style="color:purple; font-size:16px;">${d.author}</b>
                    <p style="margin:10px 0; white-space:pre-wrap;">${d.text || ""}</p>
                    ${d.mediaType === 'video' ? `<video controls playsinline style="width:100%; border-radius:8px; background:black;"><source src="${d.mediaUrl}"></video>` : ''}
                    ${d.mediaType === 'image' ? `<img src="${d.mediaUrl}" style="width:100%; border-radius:8px;">` : ''}
                    
                    <div style="display:flex; gap:15px; margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                        <button onclick="handleReact('${id}', 'likes')" style="color:${isLiked?'blue':'gray'}; border:none; background:none; font-weight:bold; cursor:pointer;">👍 Like (${d.likes || 0})</button>
                        <button onclick="handleReact('${id}', 'hahas')" style="color:${isHahaed?'orange':'gray'}; border:none; background:none; font-weight:bold; cursor:pointer;">😆 Haha (${d.hahas || 0})</button>
                    </div>

                    <div style="margin-top:10px;">
                        <div id="comms-${id}">${comms}</div>
                        <div style="display:flex; gap:5px; margin-top:8px;">
                            <input type="text" id="in-${id}" placeholder="မှတ်ချက်..." style="flex:1; border:1px solid #ddd; border-radius:20px; padding:6px 15px; color:black;">
                            <button onclick="addComment('${id}')" style="color:purple; font-weight:bold; border:none; background:none; cursor:pointer;">Send</button>
                        </div>
                    </div>
                </div>`;
        });
        feed.innerHTML = html;
    });
}

// ၆။ Logic Functions (Reaction, Comment, Preview, Delete)
async function handleReact(id, type) {
    if (!auth.currentUser) return alert("ဦးစွာ Login ဝင်ပေးပါ");
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
    const el = document.getElementById(`in-${id}`);
    if (!el.value.trim() || !auth.currentUser) return alert("မှတ်ချက်ရေးရန် Login ဝင်ပေးပါ");
    await db.collection("health_posts").doc(id).update({
        comments: firebase.firestore.FieldValue.arrayUnion({
            author: auth.currentUser.displayName || "User",
            text: el.value, likes: 0, hahas: 0, likedBy: [], hahaedBy: [], createdAt: Date.now()
        })
    });
    el.value = "";
}

async function reactComment(postId, index, type) {
    if (!auth.currentUser) return alert("ဦးစွာ Login ဝင်ပေးပါ");
    const ref = db.collection("health_posts").doc(postId);
    const snap = await ref.get();
    const comments = snap.data().comments || [];
    const c = comments[index];
    const uid = auth.currentUser.uid;
    const field = type === "likes" ? "likedBy" : "hahaedBy";
    const count = type === "likes" ? "likes" : "hahas";

    if (!c[field]) c[field] = [];
    if (c[field].includes(uid)) {
        c[field] = c[field].filter(x => x !== uid);
        c[count]--;
    } else {
        c[field].push(uid);
        c[count] = (c[count] || 0) + 1;
    }
    await ref.update({ comments });
}

function previewMedia(input) {
    const box = document.getElementById('mediaPreviewBox');
    if (input.files && input.files[0]) {
        box.style.display = 'block';
        box.innerHTML = "ရွေးထားသောဖိုင် - " + input.files[0].name;
    }
}

async function deletePost(id) {
    if(confirm("Admin... ဖျက်မှာ သေချာပါသလား?")) {
        await db.collection("health_posts").doc(id).delete();
    }
}
