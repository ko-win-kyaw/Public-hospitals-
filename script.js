// ၁။ Firebase Configuration (သင့်ရဲ့ Keys များ)
const firebaseConfig = {
    apiKey: "AIzaSyC0Elue59dRMSdQp5xyoZbVgIw9b9gqZBc",
    authDomain: "emotionn-app.firebaseapp.com",
    databaseURL: "https://emotionn-app-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "emotionn-app",
    storageBucket: "emotionn-app.appspot.com",
    messagingSenderId: "998666452056",
    appId: "1:998666452056:web:9a560311fa0814586c9e2d"
};

// Initialize Firebase safely
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();

// ၂။ API Keys & Constants
const ADMIN_EMAIL = "uwinkyawdevelopbusinessco@gmail.com";
const IMGBB_API_KEY = "C8d8d00185e973ebcafddd34f77a1176";
const BUNNY_STORAGE_KEY = "a038d7e1-bf94-448b-b863c156422e-7e4a-4299"; 
const BUNNY_ZONE = "public-hospitals";
const BUNNY_REGION = "sg"; 

let userName = localStorage.getItem("health_user_name") || "Guest";

// ၃။ Auth & Login Logic
async function loginWithNickname() {
    let nick = prompt("အသုံးပြုမည့်အမည် (Nickname) ရိုက်ထည့်ပါ:");
    if (!nick) return;
    localStorage.setItem("health_user_name", nick);
    try {
        const res = await auth.signInAnonymously();
        await res.user.updateProfile({ displayName: nick });
        location.reload();
    } catch (e) { alert("Error: " + e.message); }
}

auth.onAuthStateChanged(user => {
    if (user) {
        let name = user.displayName || localStorage.getItem("health_user_name") || "Guest";
        let isAdmin = user.email === ADMIN_EMAIL;
        
        if (isAdmin) {
            name = "Admin Developer";
            if(document.getElementById('adminBadge')) document.getElementById('adminBadge').style.display = 'block';
        }
        
        document.getElementById('userNameDisplay').innerText = "အသုံးပြုသူ: " + name;
        userName = name;
        
        loadRatingStats();
        startApp(); // Post တွေကို စတင် Load လုပ်မည်
    } else {
        loginWithNickname();
    }
});

// ၄။ Media Upload Functions
async function uploadToBunny(file) {
    const fileName = Date.now() + "_" + file.name.replace(/\s+/g, '_');
    const url = `https://${BUNNY_REGION}.storage.bunnycdn.com/${BUNNY_ZONE}/${fileName}`;
    
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'AccessKey': BUNNY_STORAGE_KEY, 'Content-Type': 'application/octet-stream' },
        body: file
    });
    if (response.ok) return `https://${BUNNY_ZONE}.b-cdn.net/${fileName}`;
    throw new Error("Bunny Upload Failed");
}

async function uploadToImgBB(file) {
    let formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: "POST", body: formData
    });
    const data = await res.json();
    return data.data.url;
}

// ၅။ Post တင်ခြင်း နှင့် Progress Bar Logic
async function uploadAndPost() {
    const content = document.getElementById('postContent').value;
    const vFile = document.getElementById('videoInput').files[0];
    const iFile = document.getElementById('imageInput').files[0];
    const btn = document.getElementById('btnPost');
    
    const progressBox = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    if (!content && !vFile && !iFile) return alert("စာသား သို့မဟုတ် မီဒီယာတစ်ခုခု ထည့်ပါ");
    
    btn.disabled = true;
    progressBox.style.display = 'block';

    // Simulated Progress Bar
    let p = 0;
    let interval = setInterval(() => {
        p += (p < 90) ? 5 : 0;
        if(progressFill) progressFill.style.width = p + "%";
        if(progressText) progressText.innerText = "တင်နေသည်: " + p + "%";
    }, 300);

    try {
        let mediaUrl = "";
        let mediaType = "none";

        if (vFile) {
            if (vFile.size > 20 * 1024 * 1024) throw new Error("ဗီဒီယိုမှာ 20MB ထက်ကြီးနေပါတယ်");
            mediaUrl = await uploadToBunny(vFile);
            mediaType = "video";
        } else if (iFile) {
            mediaUrl = await uploadToImgBB(iFile);
            mediaType = "image";
        }

        await db.collection("health_posts").add({
            uid: auth.currentUser.uid,
            author: userName,
            content: content,
            mediaUrl: mediaUrl,
            mediaType: mediaType,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            isPinned: false,
            likes: 0,
            likedBy: [],
            comments: []
        });

        clearInterval(interval);
        if(progressFill) progressFill.style.width = "100%";
        alert("Post တင်ပြီးပါပြီ!");
        location.reload();
    } catch (e) {
        alert(e.message);
        clearInterval(interval);
        progressBox.style.display = 'none';
    } finally {
        btn.disabled = false;
    }
}

// ၆။ Stable Feed Logic (Real-time Updates)
function startApp() {
    db.collection("health_posts").orderBy("isPinned", "desc").orderBy("createdAt", "desc").onSnapshot(snap => {
        const feed = document.getElementById('newsFeed');
        if(!feed) return;
        feed.innerHTML = ""; // Clear existing posts

        snap.forEach(doc => {
            const d = doc.data();
            const id = doc.id;
            const isAdmin = auth.currentUser && auth.currentUser.email === ADMIN_EMAIL;
            
            const postCard = document.createElement('div');
            postCard.className = "card";
            postCard.innerHTML = `
                <div style="margin-bottom:10px;">
                    <b>${d.author}</b> ${d.isPinned ? '📌' : ''}
                    ${isAdmin ? `<span onclick="deletePost('${id}')" style="float:right; color:red; cursor:pointer;">🗑️</span>` : ''}
                    ${isAdmin ? `<span onclick="togglePin('${id}', ${d.isPinned})" style="float:right; margin-right:10px; cursor:pointer;">${d.isPinned ? '📍' : '📌'}</span>` : ''}
                </div>
                <p style="white-space:pre-wrap;">${d.content}</p>
                ${d.mediaType === 'image' ? `<img src="${d.mediaUrl}" style="width:100%; border-radius:8px;">` : ''}
                ${d.mediaType === 'video' ? `<video controls playsinline style="width:100%; border-radius:8px;"><source src="${d.mediaUrl}" type="video/mp4"></video>` : ''}
                <div style="margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                    <button onclick="reactPost('${id}')" style="border:none; background:none; cursor:pointer;">👍 Like (${d.likes || 0})</button>
                </div>
            `;
            feed.appendChild(postCard);
        });
        setupVideoObserver();
    });
}

// ၇။ Rating & Stats
async function loadRatingStats() {
    const snap = await db.collection("app_feedback").get();
    let total = 0, counts = {1:0, 2:0, 3:0, 4:0, 5:0};
    snap.forEach(doc => {
        let r = doc.data().rating;
        if(counts[r] !== undefined) counts[r]++;
        total += r;
    });
    const avg = snap.size > 0 ? (total / snap.size).toFixed(1) : 0.0;
    if(document.getElementById('averageRatingDisplay')) document.getElementById('averageRatingDisplay').innerText = `⭐ ${avg}`;
    for(let i=1; i<=5; i++) {
        const el = document.getElementById(`c${i}`);
        if(el) el.innerText = counts[i];
    }
}

// ၈။ Video Observer
function setupVideoObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target;
            if (!entry.isIntersecting) video.pause();
        });
    }, { threshold: 0.5 });
    document.querySelectorAll('video').forEach(v => observer.observe(v));
}

// ၉။ Admin & Actions
async function deletePost(id) {
    if (confirm("ဤ Post ကို ဖျက်မှာ သေချာပါသလား?")) await db.collection("health_posts").doc(id).delete();
}

async function togglePin(id, status) {
    await db.collection("health_posts").doc(id).update({ isPinned: !status });
}

async function reactPost(id) {
    const uid = auth.currentUser.uid;
    const ref = db.collection("health_posts").doc(id);
    const doc = await ref.get();
    const d = doc.data();
    
    if((d.likedBy || []).includes(uid)) {
        await ref.update({ likedBy: firebase.firestore.FieldValue.arrayRemove(uid), likes: firebase.firestore.FieldValue.increment(-1) });
    } else {
        await ref.update({ likedBy: firebase.firestore.FieldValue.arrayUnion(uid), likes: firebase.firestore.FieldValue.increment(1) });
    }
}
