// --- ၀။ Fingerprint & Firebase Init ---
async function getMyDeviceId() {
    try {
        if (typeof FingerprintJS === 'undefined') return "unknown";
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        return result.visitorId;
    } catch (e) { return "error_id"; }
}

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

// --- ၁။ Observers (Video Auto-pause & Scroll Views) ---
const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const video = entry.target;
        if (!entry.isIntersecting || entry.intersectionRatio < 0.8) {
            video.pause();
        }
    });
}, { threshold: [0, 0.8] });

const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const postId = entry.target.getAttribute('data-id');
            const viewed = entry.target.getAttribute('data-viewed');
            if (postId && viewed !== "true") {
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

async function incrementView(id) {
    db.collection("health_posts").doc(id).update({
        views: firebase.firestore.FieldValue.increment(1)
    }).catch(e => {});
}

// --- Post တင်သည့်စနစ် (ပြင်ဆင်ပြီးသား) ---
async function uploadAndPost() {
    const textInput = document.getElementById('postContent');
    const fileInput = document.getElementById('mediaInput');
    const btn = document.getElementById('btnPost');
    
    if (!textInput || !fileInput) return;
    const text = textInput.value.trim();
    const file = fileInput.files[0];

    if (!text && !file) return alert("စာ သို့မဟုတ် ဖိုင်တစ်ခုခု ထည့်ပါ");
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ");

    btn.disabled = true;
    btn.innerText = "တင်နေသည်...";

    let mediaUrl = "";
    let mediaType = "";
    const timestamp = Date.now(); // အချိန်ကို တစ်နေရာတည်းမှာ သတ်မှတ်မယ်

    try {
        if (file) {
            if (file.type.startsWith('video/')) {
                mediaType = 'video';
                // Bunny Storage သို့ တင်ခြင်း
                const fileName = `${timestamp}_${file.name.replace(/\s/g, '_')}`; // နာမည်ထဲက space တွေကို ဖယ်မယ်
                const response = await fetch(`https://storage.bunnycdn.com/${BUNNY_STORAGE}/${fileName}`, {
                    method: 'PUT',
                    headers: { 'AccessKey': BUNNY_KEY, 'Content-Type': 'application/octet-stream' },
                    body: file
                });
                if (response.ok) {
                    mediaUrl = `https://public-hospitals.b-cdn.net/${fileName}`;
                } else {
                    throw new Error("Bunny Upload Failed");
                }
            } else {
                mediaType = 'image';
                const formData = new FormData();
                formData.append('image', file);
                const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
                    method: 'POST',
                    body: formData
                });
                const resData = await response.json();
                if (resData.success) mediaUrl = resData.data.url;
            }
        }

        // Firestore ထဲသို့ Post ထည့်ခြင်း
        await db.collection("health_posts").add({
            author: auth.currentUser.displayName || "User",
            text: text,
            mediaUrl: mediaUrl,
            mediaType: mediaType,
            likes: 0, hahas: 0, views: 0, shares: 0,
            likedBy: [], hahaedBy: [], comments: [],
            isPinned: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        textInput.value = "";
        fileInput.value = "";
        alert("တင်ပြီးပါပြီ Senior!");
        location.reload(); // UI Update ဖြစ်သွားအောင် reload လုပ်ပေးတာ ပိုစိတ်ချရပါတယ်
    } catch (e) {
        console.error("Error Details:", e);
        alert("အမှားအယွင်းရှိပါသည်: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "တင်မည်";
    }
}

// --- Video ပေါ်အောင် ပြန်ပြင်ထားတဲ့ HTML Render ---
function renderPostHTML(id, d, uid, isAdmin) {
    const isLiked = (d.likedBy || []).includes(uid);
    const isHahaed = (d.hahaedBy || []).includes(uid);
    
    // Video tag မှာ playsinline နဲ့ type ကို ထည့်သွင်းပေးထားပါတယ်
    let mediaHTML = "";
    if (d.mediaUrl) {
        if (d.mediaType === 'video') {
            mediaHTML = `
                <video controls playsinline style="width:100%; border-radius:8px; margin-top:10px; background:black;">
                    <source src="${d.mediaUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>`;
        } else {
            mediaHTML = `<img src="${d.mediaUrl}" style="width:100%; border-radius:8px; margin-top:10px;">`;
        }
    }

    return `
        <div style="float:right;">
            ${isAdmin ? `<button onclick="deletePost('${id}')" style="border:none; background:none; cursor:pointer;">🗑️</button>` : ''}
        </div>
        <b style="color:purple;">${d.author}</b>
        <p style="margin:10px 0; white-space:pre-wrap; font-size:14px;">${d.text || ""}</p>
        <div>${mediaHTML}</div>
        ... (Senior ရဲ့ မူလ Code အတိုင်း ဆက်ရေးပါ) ...
    `;
}
// --- ၂။ Post တင်သည့်စနစ် (Localhost Support & 20MB Limit) ---
async function uploadAndPost() {
    const textInput = document.getElementById('postContent');
    const fileInput = document.getElementById('mediaInput');
    const btn = document.getElementById('btnPost');
    
    if (!textInput || !fileInput) return;
    const text = textInput.value.trim();
    const file = fileInput.files[0];

    if (file) {
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > 20) {
            alert("ဖိုင်ဆိုဒ်က " + fileSizeMB.toFixed(2) + " MB ဖြစ်နေပါတယ်။ ၂၀ MB အောက်သာ တင်ပါဗျာ။");
            return;
        }
    }

    if (!text && !file) return alert("စာ သို့မဟုတ် ဖိုင်တစ်ခုခု ထည့်ပါ");
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ");

    btn.disabled = true;
    btn.innerText = "တင်နေသည်...";

    let mediaUrl = "";
    let mediaType = "";

    try {
        if (file) {
            if (file.type.startsWith('video/')) {
                mediaType = 'video';
                // Bunny Stream Upload
                const response = await fetch(`https://storage.bunnycdn.com/${BUNNY_STORAGE}/${Date.now()}_${file.name}`, {
                    method: 'PUT',
                    headers: { 'AccessKey': BUNNY_KEY, 'Content-Type': 'application/octet-stream' },
                    body: file
                });
                if (response.ok) mediaUrl = `https://public-hospitals.b-cdn.net/${Date.now()}_${file.name}`;
            } else {
                mediaType = 'image';
                // ImgBB Upload
                const formData = new FormData();
                formData.append('image', file);
                const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
                    method: 'POST',
                    body: formData
                });
                const resData = await response.json();
                if (resData.success) mediaUrl = resData.data.url;
            }
        }

        if (file && !mediaUrl) throw new Error("Upload Failed");

        await db.collection("health_posts").add({
            author: auth.currentUser.displayName || "User",
            text: text,
            mediaUrl: mediaUrl,
            mediaType: mediaType,
            likes: 0, hahas: 0, views: 0, shares: 0,
            likedBy: [], hahaedBy: [], comments: [],
            isPinned: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        textInput.value = "";
        fileInput.value = "";
        alert("တင်ပြီးပါပြီ Senior!");
    } catch (e) {
        console.error("Upload Error:", e);
        alert("Media တင်လို့မရပါ (Network သို့မဟုတ် API သော့ အမှားဖြစ်နိုင်ပါသည်)");
    } finally {
        btn.disabled = false;
        btn.innerText = "တင်မည်";
    }
}

// --- ၃။ Auth & Load Posts (UI Stability) ---
auth.onAuthStateChanged(async (user) => {
    const nameDisplay = document.getElementById('userNameDisplay');
    const nameModal = document.getElementById('nameSetupModal');
    if (user) {
        if (!user.displayName) {
            if (nameModal) nameModal.style.display = 'flex';
        } else {
            if (nameModal) nameModal.style.display = 'none';
            if (nameDisplay) nameDisplay.innerText = user.displayName;
        }
    } else {
        if (nameDisplay) nameDisplay.innerText = "ဧည့်သည် (Guest)";
    }
    if (!window.postsLoaded) { loadPosts(); window.postsLoaded = true; }
});

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
                div.setAttribute('data-id', id);
                div.style = `background:white; margin-bottom:15px; padding:15px; border-radius:12px; border:${d.isPinned?'2px solid orange':'none'}; text-align:left; color:black; box-shadow:0 2px 5px rgba(0,0,0,0.1);`;
                div.innerHTML = renderPostHTML(id, d, uid, isAdmin);
                if (d.isPinned) feed.prepend(div); else feed.appendChild(div);
            } else if (change.type === "modified" && postEl) {
                postEl.innerHTML = renderPostHTML(id, d, uid, isAdmin);
            } else if (change.type === "removed" && postEl) {
                postEl.remove();
            }
        });
        setTimeout(observeElements, 1000);
    });
}

function renderPostHTML(id, d, uid, isAdmin) {
    const isLiked = (d.likedBy || []).includes(uid);
    const isHahaed = (d.hahaedBy || []).includes(uid);
    let mediaHTML = d.mediaUrl ? (d.mediaType === 'video' ? 
        `<video onplay="incrementView('${id}')" controls style="width:100%; border-radius:8px; margin-top:10px;"><source src="${d.mediaUrl}"></video>` : 
        `<img src="${d.mediaUrl}" style="width:100%; border-radius:8px; margin-top:10px;">`) : "";

    return `
        <div style="float:right;">
            ${isAdmin ? `<button onclick="deletePost('${id}')" style="border:none; background:none; cursor:pointer;">🗑️</button>` : ''}
        </div>
        <b style="color:purple;">${d.author}</b>
        <p style="margin:10px 0; white-space:pre-wrap; font-size:14px;">${d.text || ""}</p>
        <div>${mediaHTML}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
            <div style="display:flex; gap:12px;">
                <span onclick="handleReact('${id}', 'likes')" style="cursor:pointer; font-weight:bold; color:${isLiked?'blue':'gray'}">👍 (${d.likes || 0})</span>
                <span onclick="handleReact('${id}', 'hahas')" style="cursor:pointer; font-weight:bold; color:${isHahaed?'orange':'gray'}">😆 (${d.hahas || 0})</span>
            </div>
            <div style="font-size:12px; color:gray; display:flex; gap:10px;">
                <span>👁️ ${d.views || 0}</span>
                <span onclick="handleShare('${id}')" style="cursor:pointer; color:purple; font-weight:bold;">🚀 Share (${d.shares || 0})</span>
            </div>
        </div>
        <div style="margin-top:10px;">
            <div id="comms-${id}">${renderComments(id, d.comments, isAdmin, uid)}</div>
            <div style="display:flex; gap:5px; margin-top:8px;">
                <input type="text" id="in-${id}" placeholder="မှတ်ချက်..." style="flex:1; border-radius:15px; border:1px solid #ddd; padding:5px 10px;">
                <button onclick="addComment('${id}')" style="color:purple; border:none; background:none; font-weight:bold;">Send</button>
            </div>
        </div>`;
}

// --- ၄။ Share, Reaction & Comment Logic ---
async function handleShare(id) {
    try {
        await db.collection("health_posts").doc(id).update({
            shares: firebase.firestore.FieldValue.increment(1)
        });
        alert("Share Count တိုးသွားပါပြီ!"); 
    } catch (e) { alert("Share လုပ်မရပါ"); }
}

async function handleReact(id, type) {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ");
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

async function addComment(id) {
    const el = document.getElementById(`in-${id}`);
    if (!auth.currentUser || !el.value.trim()) return;
    await db.collection("health_posts").doc(id).update({
        comments: firebase.firestore.FieldValue.arrayUnion({
            author: auth.currentUser.displayName,
            text: el.value.trim(), likedBy: [], hahaedBy: [], likes: 0, hahas: 0, createdAt: Date.now()
        })
    });
    el.value = "";
}
async function saveInitialName() {
    const newName = document.getElementById('setupUserName').value.trim();
    if (newName.length < 2) return alert("အမည်ရိုက်ပါ");
    await auth.currentUser.updateProfile({ displayName: newName });
    location.reload();
}

async function deletePost(id) { if(confirm("ဖျက်မှာလား?")) await db.collection("health_posts").doc(id).delete(); }
// ၁။ Comment Render လုပ်သည့်အပိုင်း (Like/Haha Button များ ပါဝင်သည်)
function renderComments(id, comments, isAdmin, uid) {
    return (comments || []).map((c, i) => `
        <div style="background:#f0f2f5; margin-bottom:5px; padding:8px; border-radius:8px; font-size:12px; position:relative;">
            <b>${c.author}</b>: ${c.text}
            ${isAdmin ? `<span onclick="deleteComment('${id}', ${i})" style="position:absolute; right:5px; color:red; cursor:pointer;">×</span>` : ''}
            
            <div style="font-size:10px; margin-top:4px; display:flex; gap:10px;">
                <span onclick="reactComment('${id}', ${i}, 'likes')" style="cursor:pointer; font-weight:bold; color:${(c.likedBy||[]).includes(uid)?'blue':'gray'}">
                    👍 ${c.likes||0}
                </span>
                <span onclick="reactComment('${id}', ${i}, 'hahas')" style="cursor:pointer; font-weight:bold; color:${(c.hahaedBy||[]).includes(uid)?'orange':'gray'}">
                    😆 ${c.hahas||0}
                </span>
            </div>
        </div>`).join('');
}

// ၂။ Comment ကို Reaction ပေးသည့် Logic Function
async function reactComment(postId, index, type) {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ");
    
    const ref = db.collection("health_posts").doc(postId);
    const snap = await ref.get();
    if (!snap.exists) return;

    let comments = [...snap.data().comments];
    let c = comments[index];
    const uid = auth.currentUser.uid;
    
    const field = type === 'likes' ? 'likedBy' : 'hahaedBy';
    const countField = type === 'likes' ? 'likes' : 'hahas';

    if (!c[field]) c[field] = [];

    // ပေးပြီးသားဆိုရင် ပြန်ဖြုတ်မယ်၊ မပေးရသေးရင် အသစ်ထည့်မယ်
    if (c[field].includes(uid)) {
        c[field] = c[field].filter(x => x !== uid);
        c[countField] = Math.max(0, (c[countField] || 0) - 1);
    } else {
        c[field].push(uid);
        c[countField] = (c[countField] || 0) + 1;
    }

    // Firestore ထဲမှာ Update လုပ်မယ်
    await ref.update({ comments });
}
async function deleteComment(postId, commentIndex) {
    if (!confirm("ဒီမှတ်ချက်ကို ဖျက်မှာ သေချာလား?")) return;

    try {
        const ref = db.collection("health_posts").doc(postId);
        const snap = await ref.get();
        if (!snap.exists) return;

        let comments = [...snap.data().comments];
        
        // ရွေးချယ်လိုက်တဲ့ Index က မှတ်ချက်ကို ဖယ်ထုတ်လိုက်တာ
        comments.splice(commentIndex, 1);

        // Firestore မှာ Update ပြန်လုပ်တာ
        await ref.update({ comments });
        alert("မှတ်ချက်ကို ဖျက်လိုက်ပါပြီ။");
    } catch (e) {
        console.error("Delete error:", e);
        alert("ဖျက်လို့မရပါဘူးဗျာ။");
    }
}
