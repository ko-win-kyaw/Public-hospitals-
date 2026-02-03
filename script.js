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

// ၂။ Keys & Constants
const ADMIN_EMAIL = "uwinkyawdevelopbusinessco@gmail.com";
const IMGBB_API_KEY = "C8d8d00185e973ebcafddd34f77a1176";
const BUNNY_STORAGE_KEY = "A038d7e1-bf94-448b-b863c156422e-7e4a-4299"; 
const BUNNY_ZONE = "public-hospitals";
const BUNNY_REGION = "sg"; // Singapore region

let userName = localStorage.getItem("health_user_name") || "Guest";
let selectedRatingValue = 0;

// ၃။ Authentication
auth.onAuthStateChanged(async (user) => {
    if (user) {
        userName = user.displayName || localStorage.getItem("health_user_name") || "Guest";
        if (user.email === ADMIN_EMAIL) {
            userName = "Admin Developer";
            if(document.getElementById('adminBadge')) document.getElementById('adminBadge').style.display = 'block';
        }
        document.getElementById('userNameDisplay').innerText = "အသုံးပြုသူ: " + userName;
        
        // Rating ပေးပြီးသားလား စစ်ဆေးခြင်း
        const rDoc = await db.collection("app_feedback").doc(user.uid).get();
        if(document.getElementById('ratingInputBox')) {
            document.getElementById('ratingInputBox').style.display = rDoc.exists ? 'none' : 'block';
        }
        startApp();
    } else {
        auth.signInAnonymously();
    }
});

// ၄။ Rating & Feedback စနစ်
function setRating(n) {
    selectedRatingValue = n;
    document.querySelectorAll('#ratingStars span').forEach((s, i) => s.classList.toggle('active', i < n));
}

async function submitFeedback() {
    if (selectedRatingValue === 0) return alert("ကြယ်ပွင့်ရွေးပါ");
    const fbText = document.getElementById('feedbackText').value;
    try {
        await db.collection("app_feedback").doc(auth.currentUser.uid).set({ 
            rating: selectedRatingValue, text: fbText, userId: auth.currentUser.uid, createdAt: Date.now() 
        });
        await db.collection("health_posts").add({ 
            author: userName, text: `⭐ App Rating: ${selectedRatingValue}/5\n"${fbText}"`, likes: 0, hahas: 0, comments: [], isPinned: false, createdAt: Date.now() 
        });
        alert("ကျေးဇူးတင်ပါတယ်!");
        document.getElementById('ratingInputBox').style.display = 'none';
    } catch (e) { alert("Feedback Error: " + e); }
}

// ၅။ Main App (UI ရှင်းလင်းရေးနှင့် ဗီဒီယို ပေါ်ရန် ပြင်ဆင်မှု)
function startApp() {
    db.collection("health_posts").orderBy("isPinned", "desc").orderBy("createdAt", "desc").onSnapshot(snap => {
        const feed = document.getElementById('newsFeed');
        if(!feed) return;
        feed.innerHTML = "";
        const isAdmin = auth.currentUser && auth.currentUser.email === ADMIN_EMAIL;
        const uid = auth.currentUser ? auth.currentUser.uid : null;

        snap.forEach(doc => {
            const d = doc.data(); const id = doc.id;
            
            // Admin Controls
            let adminUI = isAdmin ? `
                <div style="background:#f0f0f0; padding:8px; border-radius:8px; margin-bottom:10px; display:flex; gap:15px; font-size:12px;">
                    <span style="color:blue; cursor:pointer; font-weight:bold;" onclick="togglePin('${id}', ${d.isPinned})">${d.isPinned ? '📍 Unpin' : '📌 Pin'}</span>
                    <span style="color:red; cursor:pointer; font-weight:bold;" onclick="deletePost('${id}')">🗑️ Post ဖျက်ရန်</span>
                </div>` : '';

            // Comments Logic
            let commentsHtml = (d.comments || []).map(c => `
                <div style="border-bottom:1px solid #eee; padding:8px 0; font-size:14px;">
                    <div style="display:flex; justify-content:space-between;"><b>${c.author}</b>
                    ${isAdmin ? `<span style="color:red; cursor:pointer; font-size:10px;" onclick="deleteComment('${id}','${c.id}')">🗑️</span>` : ''}</div>
                    <div style="margin:4px 0;">${c.text}</div>
                    <div style="display:flex; gap:15px; font-size:12px; color:#555;">
                        <span onclick="reactComment('${id}','${c.id}','likes')" style="cursor:pointer; ${(c.likedBy||[]).includes(uid)?'color:blue;font-weight:bold;':''}">👍 (${c.likes||0})</span>
                        <span onclick="reactComment('${id}','${c.id}','hahas')" style="cursor:pointer; ${(c.hahaedBy||[]).includes(uid)?'color:orange;font-weight:bold;':''}">😆 (${c.hahas||0})</span>
                    </div>
                </div>`).join('');

            feed.innerHTML += `
                <div class="card" style="border:1px solid #ddd; padding:15px; border-radius:12px; margin-bottom:20px; background:#fff; position:relative;">
                    ${adminUI}
                    <div style="margin-bottom:10px;"><b>${d.author}</b> ${d.isPinned ? '📌' : ''}</div>
                    <p style="white-space:pre-wrap; margin-bottom:10px;">${d.text}</p>
                    ${d.imageUrl ? `<img src="${d.imageUrl}" style="width:100%; border-radius:8px; margin-bottom:10px;">` : ''}
                    ${d.videoUrl ? `<video controls playsinline preload="metadata" style="width:100%; border-radius:8px; margin-bottom:10px; background:#000;"><source src="${d.videoUrl}" type="video/mp4">Browser error</video>` : ''}
                    
                    <div style="display:flex; gap:10px; border-top:1px solid #eee; padding-top:10px;">
                        <button onclick="reactPost('${id}', 'likes')" style="flex:1; border:none; padding:8px; border-radius:5px; background:#f8f9fa; ${(d.likedBy||[]).includes(uid)?'color:blue;font-weight:bold;':''}">👍 Like (${d.likes||0})</button>
                        <button onclick="reactPost('${id}', 'hahas')" style="flex:1; border:none; padding:8px; border-radius:5px; background:#f8f9fa; ${(d.hahaedBy||[]).includes(uid)?'color:orange;font-weight:bold;':''}">😆 Haha (${d.hahas||0})</button>
                    </div>

                    <div style="margin-top:15px; background:#fafafa; padding:10px; border-radius:8px;">
                        ${commentsHtml}
                        <div style="display:flex; gap:5px; margin-top:10px;">
                            <input type="text" id="in-${id}" placeholder="မှတ်ချက်..." style="flex:1; border-radius:20px; border:1px solid #ddd; padding:5px 12px; outline:none;">
                            <button onclick="addComment('${id}')" style="border:none; background:none; color:purple; font-weight:bold; cursor:pointer;">Send</button>
                        </div>
                    </div>
                </div>`;
        });
    });
}

// ၆။ Media Upload (Bunny.net CORS ကျော်ရန် ပြုပြင်ထားသောအပိုင်း)
async function uploadAndPost() {
    const text = document.getElementById('postContent').value;
    const imgFile = document.getElementById('imageInput').files[0];
    const vidFile = document.getElementById('videoInput').files[0];
    const btn = document.getElementById('btnPost');

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
            const storageUrl = `https://${BUNNY_REGION}.storage.bunnycdn.com/${BUNNY_ZONE}/${fileName}`;
            
            const res = await fetch(storageUrl, {
                method: "PUT",
                headers: { "AccessKey": BUNNY_STORAGE_KEY, "Content-Type": "application/octet-stream" },
                body: vidFile
            });

            if(res.status === 201 || res.status === 200) {
                // Dashboard setting မလိုဘဲ ပေါ်အောင် storage URL ကို တိုက်ရိုက်သုံးသည်
                videoUrl = storageUrl; 
            }
        }
        await db.collection("health_posts").add({ 
            author: userName, text, imageUrl, videoUrl, likes: 0, hahas: 0, 
            comments: [], isPinned: false, createdAt: Date.now() 
        });
        location.reload();
    } catch (e) { alert("Upload Error: " + e); btn.disabled = false; btn.innerText = "တင်မည်"; }
}

// ၇။ Actions (Pin, Delete, Reactions)
async function deletePost(id) { if(confirm("Post ကို ဖျက်မှာလား?")) await db.collection("health_posts").doc(id).delete(); }
async function togglePin(id, status) { await db.collection("health_posts").doc(id).update({ isPinned: !status }); }
async function addComment(id) {
    const val = document.getElementById(`in-${id}`).value; if(!val) return;
    const nc = { id: Date.now().toString(), author: userName, text: val, likes:0, hahas:0, likedBy:[], hahaedBy:[] };
    await db.collection("health_posts").doc(id).update({ comments: firebase.firestore.FieldValue.arrayUnion(nc) });
    document.getElementById(`in-${id}`).value = "";
}
async function reactPost(id, type) {
    const uid = auth.currentUser.uid; const ref = db.collection("health_posts").doc(id); const d = (await ref.get()).data();
    const list = type === 'likes' ? 'likedBy' : 'hahaedBy'; const count = type === 'likes' ? 'likes' : 'hahas';
    if((d[list]||[]).includes(uid)) { await ref.update({ [list]: firebase.firestore.FieldValue.arrayRemove(uid), [count]: firebase.firestore.FieldValue.increment(-1) }); }
    else { await ref.update({ [list]: firebase.firestore.FieldValue.arrayUnion(uid), [count]: firebase.firestore.FieldValue.increment(1) }); }
}
async function deleteComment(postId, commentId) {
    const ref = db.collection("health_posts").doc(postId); const doc = await ref.get();
    const updated = doc.data().comments.filter(c => c.id !== commentId);
    await ref.update({ comments: updated });
}
async function reactComment(pId, cId, type) {
    const uid = auth.currentUser.uid; const ref = db.collection("health_posts").doc(pId); const doc = await ref.get();
    const comments = doc.data().comments.map(c => {
        if (c.id === cId) {
            const list = type === 'likes' ? 'likedBy' : 'hahaedBy'; const count = type === 'likes' ? 'likes' : 'hahas';
            if (!c[list]) c[list] = [];
            if (c[list].includes(uid)) { c[list] = c[list].filter(i => i !== uid); c[count] = (c[count] || 1) - 1; }
            else { c[list].push(uid); c[count] = (c[count] || 0) + 1; }
        } return c;
    }); await ref.update({ comments });
}
