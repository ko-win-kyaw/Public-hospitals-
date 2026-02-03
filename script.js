// ၁။ Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyD4Yiez3VXKD90za0wnt03lFPjeln4su7U",
    authDomain: "hospital-app-caf85.firebaseapp.com",
    projectId: "hospital-app-caf85",
    storageBucket: "hospital-app-caf85.firebasestorage.app",
    messagingSenderId: "736486429191",
    appId: "1:736486429191:web:25c116beb3994d213cd0a2"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// ၂။ Constants & Admin Info
const ADMIN_EMAIL = "uwinkyawdevelopbusinessco@gmail.com";
const IMGBB_API_KEY = "C8d8d00185e973ebcafddd34f77a1176";
const BUNNY_STORAGE_KEY = "a038d7e1-bf94-448b-b863c156422e-7e4a-4299"; 
const BUNNY_ZONE = "public-hospitals";
const BUNNY_REGION = "sg"; 

let userName = localStorage.getItem("health_user_name") || "Guest";
let selectedRatingValue = 0;

// ၃။ Auth & Start App
auth.onAuthStateChanged(async (user) => {
    if (user) {
        userName = user.displayName || localStorage.getItem("health_user_name") || "Guest";
        if (user.email === ADMIN_EMAIL) userName = "Admin Developer";
        document.getElementById('userNameDisplay').innerText = "အသုံးပြုသူ: " + userName;
        
        // Rating ပေးပြီးသားလား စစ်ဆေးခြင်း
        const rDoc = await db.collection("app_feedback").doc(user.uid).get();
        if(document.getElementById('ratingInputBox')) {
            document.getElementById('ratingInputBox').style.display = rDoc.exists ? 'none' : 'block';
        }
        startApp(); // Start the Stable Feed
    } else {
        auth.signInAnonymously();
    }
});

// ၄။ Stable Feed Logic (Blinking နှင့် Video ပျောက်ခြင်းကို ကာကွယ်ရန်)
function startApp() {
    db.collection("health_posts").orderBy("isPinned", "desc").orderBy("createdAt", "desc").onSnapshot(snap => {
        const feed = document.getElementById('newsFeed');
        if(!feed) return;
        
        const uid = auth.currentUser ? auth.currentUser.uid : "guest";
        const isAdmin = auth.currentUser && auth.currentUser.email === ADMIN_EMAIL;

        snap.docChanges().forEach(change => {
            const d = change.doc.data();
            const id = change.doc.id;

            if (change.type === "added") {
                const postCard = createPostElement(id, d, uid, isAdmin);
                // Pin လုပ်ထားရင် အပေါ်ဆုံးမှာ ထားမည်
                if (d.isPinned) feed.prepend(postCard); else feed.appendChild(postCard);
            } 
            if (change.type === "modified") {
                // Video Player ကို မထိဘဲ Reaction နှင့် Comment ကိုပဲ ကွက်ပြင်မည်
                updateSpecificData(id, d, uid, isAdmin);
            }
            if (change.type === "removed") {
                const el = document.getElementById(`post-${id}`);
                if (el) el.remove();
            }
        });
    });
}

// ၅။ UI ကွက်ပြင်သည့် Function (Video Stability အတွက် အဓိက)
function updateSpecificData(id, d, uid, isAdmin) {
    const likeBtn = document.querySelector(`#post-${id} .like-btn`);
    const hahaBtn = document.querySelector(`#post-${id} .haha-btn`);
    const commentBox = document.querySelector(`#post-${id} .comments-list`);

    if (likeBtn) {
        likeBtn.innerHTML = `👍 Like (${d.likes || 0})`;
        likeBtn.style.color = (d.likedBy || []).includes(uid) ? "blue" : "black";
    }
    if (hahaBtn) {
        hahaBtn.innerHTML = `😆 Haha (${d.hahas || 0})`;
        hahaBtn.style.color = (d.hahaedBy || []).includes(uid) ? "orange" : "black";
    }
    if (commentBox) {
        commentBox.innerHTML = renderCommentsHtml(id, d.comments || [], isAdmin, uid);
    }
}

// ၆။ Element Creation (Initial)
function createPostElement(id, d, uid, isAdmin) {
    const div = document.createElement('div');
    div.id = `post-${id}`;
    div.className = "card";
    div.style = "border:1px solid #ddd; padding:15px; border-radius:12px; margin-bottom:20px; background:#fff;";
    
    div.innerHTML = `
        <div class="admin-ui">${isAdmin ? `
            <div style="background:#f0f0f0; padding:8px; border-radius:8px; margin-bottom:10px; display:flex; gap:15px; font-size:12px;">
                <span onclick="togglePin('${id}', ${d.isPinned})" style="color:blue; cursor:pointer; font-weight:bold;">${d.isPinned ? '📍 Unpin' : '📌 Pin'}</span>
                <span onclick="deletePost('${id}')" style="color:red; cursor:pointer; font-weight:bold;">🗑️ Delete Post</span>
            </div>` : ''}</div>
        <div style="margin:10px 0;"><b>${d.author}</b> ${d.isPinned ? '📌' : ''}</div>
        <p style="white-space:pre-wrap;">${d.text}</p>
        ${d.imageUrl ? `<img src="${d.imageUrl}" style="width:100%; border-radius:8px; margin:10px 0;">` : ''}
        ${d.videoUrl ? `<video controls playsinline preload="metadata" style="width:100%; border-radius:8px; background:#000;"><source src="${d.videoUrl}" type="video/mp4"></video>` : ''}
        
        <div style="display:flex; gap:10px; border-top:1px solid #eee; padding-top:10px; margin-top:10px;">
            <button class="like-btn" onclick="reactPost('${id}', 'likes')" style="flex:1; border:none; padding:10px; border-radius:8px; background:#f8f9fa;">👍 Like (${d.likes || 0})</button>
            <button class="haha-btn" onclick="reactPost('${id}', 'hahas')" style="flex:1; border:none; padding:10px; border-radius:8px; background:#f8f9fa;">😆 Haha (${d.hahas || 0})</button>
        </div>

        <div style="margin-top:15px; background:#f9f9f9; padding:10px; border-radius:10px;">
            <div class="comments-list">${renderCommentsHtml(id, d.comments || [], isAdmin, uid)}</div>
            <div style="display:flex; gap:5px; margin-top:10px;">
                <input type="text" id="in-${id}" placeholder="မှတ်ချက်..." style="flex:1; border-radius:20px; border:1px solid #ddd; padding:8px 15px;">
                <button onclick="addComment('${id}')" style="color:purple; font-weight:bold; border:none; background:none; cursor:pointer;">Send</button>
            </div>
        </div>
    `;
    return div;
}

function renderCommentsHtml(pId, comments, isAdmin, uid) {
    return (comments || []).map(c => `
        <div style="border-bottom:1px solid #eee; padding:5px 0; font-size:14px;">
            <div style="display:flex; justify-content:space-between;"><b>${c.author}</b> 
            ${isAdmin ? `<span onclick="deleteComment('${pId}','${c.id}')" style="color:red; cursor:pointer; font-size:10px;">ဖျက်</span>` : ''}</div>
            <div>${c.text}</div>
            <div style="font-size:11px; margin-top:3px; display:flex; gap:15px;">
                <span onclick="reactComment('${pId}','${c.id}','likes')" style="cursor:pointer; ${(c.likedBy||[]).includes(uid)?'color:blue;font-weight:bold;':''}">👍 ${c.likes||0}</span>
                <span onclick="reactComment('${pId}','${c.id}','hahas')" style="cursor:pointer; ${(c.hahaedBy||[]).includes(uid)?'color:orange;font-weight:bold;':''}">😆 ${c.hahas||0}</span>
            </div>
        </div>`).join('');
}

// ၇။ Actions (Post, Media, Delete, Reaction)
async function uploadAndPost() {
    const text = document.getElementById('postContent').value;
    const imgFile = document.getElementById('imageInput').files[0];
    const vidFile = document.getElementById('videoInput').files[0];
    const btn = document.getElementById('btnPost');

    if(vidFile && vidFile.size > 20 * 1024 * 1024) return alert("ဗီဒီယိုက 20MB ထက်ကြီးနေပါတယ်။");
    if(!text && !imgFile && !vidFile) return;

    btn.disabled = true; btn.innerText = "တင်နေသည်...";
    try {
        let imageUrl = "", videoUrl = "";
        if(imgFile) {
            const fd = new FormData(); fd.append("image", imgFile);
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {method:"POST", body:fd});
            imageUrl = (await res.json()).data.url;
        }
        if(vidFile) {
            const fileName = Date.now() + "_" + vidFile.name.replace(/\s+/g, '_');
            const res = await fetch(`https://${BUNNY_REGION}.storage.bunnycdn.com/${BUNNY_ZONE}/${fileName}`, {
                method: "PUT",
                headers: { "AccessKey": BUNNY_STORAGE_KEY, "Content-Type": "application/octet-stream" },
                body: vidFile
            });
            if(res.status === 201 || res.status === 200) videoUrl = `https://public-hospitals.b-cdn.net/${fileName}`;
        }
        await db.collection("health_posts").add({ 
            author: userName, text, imageUrl, videoUrl, likes: 0, hahas: 0, 
            likedBy: [], hahaedBy: [], comments: [], isPinned: false, createdAt: Date.now() 
        });
        location.reload();
    } catch (e) { alert("Error: " + e); btn.disabled = false; }
}

async function deletePost(id) { if(confirm("Post ကို ဖျက်မှာလား?")) await db.collection("health_posts").doc(id).delete(); }
async function togglePin(id, status) { await db.collection("health_posts").doc(id).update({ isPinned: !status }); }

async function addComment(id) {
    const val = document.getElementById(`in-${id}`).value; if(!val) return;
    const nc = { id: Date.now().toString(), author: userName, text: val, likes:0, hahas:0, likedBy:[], hahaedBy:[] };
    await db.collection("health_posts").doc(id).update({ comments: firebase.firestore.FieldValue.arrayUnion(nc) });
    document.getElementById(`in-${id}`).value = "";
}

async function deleteComment(pId, cId) {
    if (!confirm("ဒီမှတ်ချက်ကို ဖျက်မှာ သေချာပါသလား?")) return;
    try {
        const ref = db.collection("health_posts").doc(pId);
        const doc = await ref.get();
        const updatedComments = doc.data().comments.filter(c => c.id !== cId);
        await ref.update({ comments: updatedComments });
    } catch (e) { alert("Error: " + e.message); }
}

async function reactPost(id, type) {
    const uid = auth.currentUser.uid; const ref = db.collection("health_posts").doc(id); const d = (await ref.get()).data();
    const list = type === 'likes' ? 'likedBy' : 'hahaedBy'; const count = type === 'likes' ? 'likes' : 'hahas';
    if((d[list]||[]).includes(uid)) { 
        await ref.update({ [list]: firebase.firestore.FieldValue.arrayRemove(uid), [count]: firebase.firestore.FieldValue.increment(-1) }); 
    } else { 
        await ref.update({ [list]: firebase.firestore.FieldValue.arrayUnion(uid), [count]: firebase.firestore.FieldValue.increment(1) }); 
    }
}

async function reactComment(pId, cId, type) {
    const uid = auth.currentUser.uid; const ref = db.collection("health_posts").doc(pId); const doc = await ref.get();
    const comments = doc.data().comments.map(c => {
        if (c.id === cId) {
            const list = type === 'likes' ? 'likedBy' : 'hahaedBy'; const count = type === 'likes' ? 'likes' : 'hahas';
            if (!c[list]) c[list] = [];
            if (c[list].includes(uid)) { c[list] = c[list].filter(i => i !== uid); c[count] = Math.max(0, (c[count] || 1) - 1); }
            else { c[list].push(uid); c[count] = (c[count] || 0) + 1; }
        } return c;
    }); await ref.update({ comments });
}

// ၈။ Rating & Star Logic
function setRating(n) {
    selectedRatingValue = n;
    document.querySelectorAll('#ratingStars span').forEach((s, i) => s.style.color = i < n ? '#ffc107' : '#ddd');
}
async function submitFeedback() {
    if (selectedRatingValue === 0) return alert("ကြယ်ပွင့်ရွေးပါ");
    const fbText = document.getElementById('feedbackText').value;
    try {
        await db.collection("app_feedback").doc(auth.currentUser.uid).set({ rating: selectedRatingValue, text: fbText, userId: auth.currentUser.uid, createdAt: Date.now() });
        alert("ကျေးဇူးတင်ပါတယ်!");
        document.getElementById('ratingInputBox').style.display = 'none';
    } catch (e) { alert("Feedback Error: " + e); }
}
