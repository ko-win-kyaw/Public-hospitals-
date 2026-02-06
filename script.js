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
const MAX_VIDEO_SIZE = 20 * 1024 * 1024;

// ၂။ Auth State
auth.onAuthStateChanged(user => {
    const nameDisplay = document.getElementById('userNameDisplay');
    const adminBadge = document.getElementById('adminBadge');
    if (user) {
        if(nameDisplay) nameDisplay.innerText = user.displayName || user.email || "User";
        if (user.email === ADMIN_EMAIL && adminBadge) adminBadge.style.display = 'inline-block';
    } else {
        if(nameDisplay) nameDisplay.innerText = "ဧည့်သည် (Guest)";
    }
    loadPosts();
});

function checkLogin() {
    if (!auth.currentUser) {
        alert("ဤလုပ်ဆောင်ချက်အတွက် ဦးစွာ Login ဝင်ပေးပါ");
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider);
        return false;
    }
    return true;
}

// ၃။ Load Posts (With Pin & Admin Delete)
function loadPosts() {
    db.collection("health_posts").orderBy("createdAt", "desc").onSnapshot(snap => {
        const feed = document.getElementById('newsFeed');
        if (!feed) return;
        
        const uid = auth.currentUser ? auth.currentUser.uid : "visitor";
        const isAdmin = auth.currentUser && auth.currentUser.email === ADMIN_EMAIL;

        let posts = [];
        snap.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));
        // Pin တာကို အပေါ်ဆုံးပို့ရန် Manual Sort လုပ်ခြင်း
        posts.sort((a, b) => (b.isPinned || false) - (a.isPinned || false));

        let html = "";
        posts.forEach(d => {
            const id = d.id;
            const isLiked = (d.likedBy || []).includes(uid);
            const isHahaed = (d.hahaedBy || []).includes(uid);

            let comms = (d.comments || []).map((c, i) => `
                <div style="background:#f0f2f5; margin-bottom:8px; padding:10px; border-radius:10px; font-size:13px; color:black; position:relative;">
                    <b>${c.author}</b>: ${c.text}
                    ${isAdmin ? `<span onclick="deleteComment('${id}', ${i})" style="position:absolute; right:10px; top:5px; color:red; cursor:pointer; font-size:11px;">[Delete]</span>` : ''}
                    <div style="margin-top:5px; display:flex; gap:12px;">
                        <span onclick="reactComment('${id}', ${i}, 'likes')" style="cursor:pointer; color:${(c.likedBy||[]).includes(uid)?'blue':'gray'}">👍 ${c.likes||0}</span>
                        <span onclick="reactComment('${id}', ${i}, 'hahas')" style="cursor:pointer; color:${(c.hahaedBy||[]).includes(uid)?'orange':'gray'}">😆 ${c.hahas||0}</span>
                    </div>
                </div>`).join('');

            html += `
                <div class="post-card" data-post-id="${id}" style="background:white; margin-bottom:15px; padding:15px; border-radius:12px; border:${d.isPinned?'2px solid orange':'none'}; color:black; text-align:left; box-shadow:0 1px 3px rgba(0,0,0,0.1); position:relative;">
                    <div style="position:absolute; right:10px; top:10px; display:flex; gap:10px; z-index:10;">
                        ${isAdmin ? `<button onclick="togglePin('${id}', ${d.isPinned||false})" style="color:orange; border:none; background:none; cursor:pointer; font-weight:bold;">${d.isPinned?'[Unpin]':'[Pin]'}</button>` : ''}
                        ${isAdmin ? `<button onclick="deletePost('${id}')" style="color:red; border:none; background:none; font-weight:bold; cursor:pointer;">[Delete]</button>` : ''}
                    </div>
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
                            <input type="text" id="in-${id}" placeholder="မှတ်ချက်..." style="flex:1; border:1px solid #ddd; border-radius:20px; padding:6px 15px;">
                            <button onclick="addComment('${id}')" style="color:purple; font-weight:bold; border:none; background:none; cursor:pointer;">Send</button>
                        </div>
                    </div>
                </div>`;
        });
        feed.innerHTML = html;
    });
}

// ၄။ Reactions Logic
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

// ၅။ Admin & Post Logic
async function togglePin(id, current) {
    await db.collection("health_posts").doc(id).update({ isPinned: !current });
}

async function deletePost(id) {
    if(confirm("ပို့စ်ကို ဖျက်မှာ သေချာပါသလား?")) await db.collection("health_posts").doc(id).delete();
}

async function deleteComment(postId, index) {
    if(!confirm("မှတ်ချက်ကို ဖျက်မှာလား?")) return;
    const ref = db.collection("health_posts").doc(postId);
    const snap = await ref.get();
    let comments = snap.data().comments || [];
    comments.splice(index, 1);
    await ref.update({ comments });
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
    if (file && file.size > MAX_VIDEO_SIZE) return alert("20MB အောက်သာ တင်ပေးပါ");

    btn.disabled = true; btn.innerText = "တင်နေသည်...";
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
            text, mediaUrl, mediaType, likes:0, hahas:0, likedBy:[], hahaedBy:[], comments:[], isPinned:false, createdAt: Date.now()
        });
        document.getElementById('postContent').value = "";
    } catch (e) { alert(e.message); }
    btn.disabled = false; btn.innerText = "Post";
}
