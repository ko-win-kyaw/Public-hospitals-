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
const ADMIN_PIN = "123456";
const IMGBB_KEY = "C8d8d00185e973ebcafddd34f77a1176"; 
const BUNNY_KEY = "a038d7e1-bf94-448b-b863c156422e-7e4a-4299"; 
const BUNNY_STORAGE = "public-hospitals";
const MAX_VIDEO_SIZE = 20 * 1024 * 1024;

let currentRating = 0;
let isAdminVerified = false;
let recaptchaVerifier;
let isReactionProcessing = false;

// ၂။ Auth State & Initialization
auth.onAuthStateChanged(user => {
    const nameDisplay = document.getElementById('userNameDisplay');
    const googleBtn = document.getElementById('googleBtn');
    const phoneLoginBtn = document.getElementById('phoneLoginBtn');
    const adminBadge = document.getElementById('adminBadge');
    const ratingBox = document.getElementById('ratingInputBox');
    const adminPinSection = document.getElementById('adminPinSection');

    if (user) {
        if(nameDisplay) nameDisplay.innerText = user.displayName || user.email || user.phoneNumber || "User";
        if(googleBtn) googleBtn.style.display = 'none';
        if(phoneLoginBtn) phoneLoginBtn.style.display = 'none';
        if(ratingBox) ratingBox.style.display = 'block';
        
        if (user.email === ADMIN_EMAIL && adminBadge) {
            adminBadge.style.display = 'inline-block';
            if(adminPinSection) adminPinSection.style.display = 'block';
        }
    } else {
        if(nameDisplay) nameDisplay.innerText = "ဧည့်သည် (Guest)";
        if(googleBtn) googleBtn.style.display = 'block';
        if(phoneLoginBtn) phoneLoginBtn.style.display = 'block';
        if(adminPinSection) adminPinSection.style.display = 'none';
        isAdminVerified = false;
    }
    loadPosts();
    loadRatings();
    initRecaptcha();
});

// ၃။ Optimized Post Loading & Updates
let postsListener = null;

function loadPosts() {
    if (postsListener) postsListener();
    
    postsListener = db.collection("health_posts")
        .orderBy("createdAt", "desc")
        .onSnapshot(snap => {
            const feed = document.getElementById('newsFeed');
            if (!feed) return;
            
            // Store current scroll position and video states
            const scrollTop = feed.scrollTop;
            const videoStates = new Map();
            feed.querySelectorAll('video').forEach(video => {
                videoStates.set(video.src, {
                    currentTime: video.currentTime,
                    paused: video.paused
                });
            });
            
            let html = "";
            const uid = auth.currentUser ? auth.currentUser.uid : "visitor";
            const isAdmin = auth.currentUser && auth.currentUser.email === ADMIN_EMAIL && isAdminVerified;

            snap.forEach(doc => {
                const d = doc.data(); 
                const id = doc.id;
                const isLiked = (d.likedBy || []).includes(uid);
                const isHahaed = (d.hahaedBy || []).includes(uid);

                html += `
                <div class="post-card" data-post-id="${id}" style="background:white; margin-bottom:15px; padding:15px; border-radius:12px; color:black; text-align:left; box-shadow:0 1px 3px rgba(0,0,0,0.1); position:relative;">
                    ${isAdmin ? `<button onclick="deletePost('${id}')" style="position:absolute; right:10px; top:10px; color:red; border:none; background:none; font-weight:bold; cursor:pointer; z-index:10;">[Delete Post]</button>` : ''}
                    <b style="color:purple; font-size:16px;">${d.author}</b>
                    <p style="margin:10px 0; white-space:pre-wrap;">${d.text || ""}</p>
                    
                    ${d.mediaType === 'video' ? 
                        `<div class="video-container" style="position:relative; width:100%; border-radius:8px; overflow:hidden; background:black;">
                            <video id="video-${id}" controls playsinline style="width:100%; max-height:400px; display:block;">
                                <source src="${d.mediaUrl}">
                            </video>
                        </div>` : ''}
                    
                    ${d.mediaType === 'image' ? 
                        `<img src="${d.mediaUrl}" style="width:100%; max-height:400px; border-radius:8px; object-fit:cover;">` : ''}
                    
                    <div class="post-reactions" style="display:flex; gap:15px; margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                        <button onclick="handleReact('${id}', 'likes', event)" 
                                style="color:${isLiked?'blue':'gray'}; border:none; background:none; font-weight:bold; cursor:pointer;"
                                data-post-id="${id}" data-type="likes">
                            👍 Like (<span id="like-count-${id}">${d.likes || 0}</span>)
                        </button>
                        <button onclick="handleReact('${id}', 'hahas', event)" 
                                style="color:${isHahaed?'orange':'gray'}; border:none; background:none; font-weight:bold; cursor:pointer;"
                                data-post-id="${id}" data-type="hahas">
                            😆 Haha (<span id="haha-count-${id}">${d.hahas || 0}</span>)
                        </button>
                    </div>
                    
                    <div class="comments-section" style="margin-top:10px;">
                        <div id="comments-${id}">${renderComments(d.comments || [], id, uid, isAdmin)}</div>
                        <div style="display:flex; gap:5px; margin-top:8px;">
                            <input type="text" id="comment-input-${id}" placeholder="မှတ်ချက်..." 
                                   style="flex:1; border:1px solid #ddd; border-radius:20px; padding:6px 15px; color:black;">
                            <button onclick="addComment('${id}', event)" 
                                    style="color:purple; font-weight:bold; border:none; background:none; cursor:pointer;">
                                Send
                            </button>
                        </div>
                    </div>
                </div>`;
            });
            
            feed.innerHTML = html;
            
            // Restore scroll position
            feed.scrollTop = scrollTop;
            
            // Restore video states
            feed.querySelectorAll('video').forEach(video => {
                const state = videoStates.get(video.src);
                if (state) {
                    video.currentTime = state.currentTime;
                    if (!state.paused && video.paused) {
                        video.play().catch(() => {});
                    }
                }
            });
        });
}

function renderComments(comments, postId, uid, isAdmin) {
    return comments.map((c, i) => {
        const cLiked = (c.likedBy || []).includes(uid);
        const cHahaed = (c.hahaedBy || []).includes(uid);
        
        return `
        <div class="comment" id="comment-${postId}-${i}" 
             style="background:#f0f2f5; margin-bottom:8px; padding:10px; border-radius:10px; font-size:13px; color:black; position:relative;">
            <b>${c.author}</b>: ${c.text}
            ${isAdmin ? `<span onclick="deleteComment('${postId}', ${i})" style="position:absolute; right:10px; top:5px; color:red; cursor:pointer; font-size:11px;">[Delete]</span>` : ''}
            <div style="margin-top:5px; display:flex; gap:12px;">
                <span onclick="reactComment('${postId}', ${i}, 'likes', event)" 
                      style="cursor:pointer; color:${cLiked?'blue':'gray'};"
                      data-post-id="${postId}" data-comment-index="${i}" data-type="likes">
                    👍 <span id="comment-like-${postId}-${i}">${c.likes||0}</span>
                </span>
                <span onclick="reactComment('${postId}', ${i}, 'hahas', event)" 
                      style="cursor:pointer; color:${cHahaed?'orange':'gray'};"
                      data-post-id="${postId}" data-comment-index="${i}" data-type="hahas">
                    😆 <span id="comment-haha-${postId}-${i}">${c.hahas||0}</span>
                </span>
            </div>
        </div>`;
    }).join('');
}

// ၄။ Optimized Reaction Handlers
async function handleReact(postId, type, event) {
    if (!auth.currentUser) return alert("ဦးစွာ Login ဝင်ပေးပါ");
    if (isReactionProcessing) return;
    
    isReactionProcessing = true;
    const button = event.target.closest('button');
    const countSpan = document.getElementById(`${type}-count-${postId}`);
    
    try {
        const ref = db.collection("health_posts").doc(postId);
        const snap = await ref.get();
        const d = snap.data();
        const uid = auth.currentUser.uid;
        const field = type === 'likes' ? 'likedBy' : 'hahaedBy';
        const countField = type === 'likes' ? 'likes' : 'hahas';
        const isReacted = (d[field] || []).includes(uid);
        
        if (isReacted) {
            await ref.update({ 
                [field]: firebase.firestore.FieldValue.arrayRemove(uid), 
                [countField]: firebase.firestore.FieldValue.increment(-1) 
            });
            // Immediate UI update
            button.style.color = 'gray';
            if (countSpan) countSpan.textContent = Math.max(0, (parseInt(countSpan.textContent) || 0) - 1);
        } else {
            await ref.update({ 
                [field]: firebase.firestore.FieldValue.arrayUnion(uid), 
                [countField]: firebase.firestore.FieldValue.increment(1) 
            });
            // Immediate UI update
            button.style.color = type === 'likes' ? 'blue' : 'orange';
            if (countSpan) countSpan.textContent = (parseInt(countSpan.textContent) || 0) + 1;
        }
    } catch (e) { 
        console.error("Reaction error:", e);
    } finally {
        isReactionProcessing = false;
    }
}

async function reactComment(postId, index, type, event) {
    if (!auth.currentUser) return alert("ဦးစွာ Login ဝင်ပေးပါ");
    if (isReactionProcessing) return;
    
    isReactionProcessing = true;
    const span = event.target.closest('span');
    const countSpan = document.getElementById(`comment-${type}-${postId}-${index}`);
    
    try {
        await db.runTransaction(async (transaction) => {
            const ref = db.collection("health_posts").doc(postId);
            const sfDoc = await transaction.get(ref);
            if (!sfDoc.exists) return;
            
            let comments = [...sfDoc.data().comments];
            let c = comments[index];
            const uid = auth.currentUser.uid;
            const field = type === "likes" ? "likedBy" : "hahaedBy";
            const count = type === "likes" ? "likes" : "hahas";
            
            if (!c[field]) c[field] = [];
            const isReacted = c[field].includes(uid);
            
            if (isReacted) {
                c[field] = c[field].filter(x => x !== uid);
                c[count] = Math.max(0, (c[count] || 1) - 1);
                // Immediate UI update
                span.style.color = 'gray';
                if (countSpan) countSpan.textContent = c[count];
            } else {
                c[field].push(uid);
                c[count] = (c[count] || 0) + 1;
                // Immediate UI update
                span.style.color = type === 'likes' ? 'blue' : 'orange';
                if (countSpan) countSpan.textContent = c[count];
            }
            
            comments[index] = c;
            transaction.update(ref, { comments });
        });
    } catch (e) {
        console.error("Comment reaction error:", e);
    } finally {
        isReactionProcessing = false;
    }
}

// ၅။ Comment & Post Functions
async function addComment(postId, event) {
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    
    if (!text || !auth.currentUser) return alert("မှတ်ချက်ရေးရန် Login ဝင်ပေးပါ");
    
    try {
        const comment = {
            author: auth.currentUser.displayName || auth.currentUser.phoneNumber || "User",
            authorId: auth.currentUser.uid,
            text: text, 
            likes: 0, 
            hahas: 0, 
            likedBy: [], 
            hahaedBy: [], 
            createdAt: Date.now()
        };
        
        await db.collection("health_posts").doc(postId).update({
            comments: firebase.firestore.FieldValue.arrayUnion(comment)
        });
        
        input.value = "";
    } catch (e) {
        alert("Comment error: " + e.message);
    }
}

// ၆။ Media & Post Control
async function uploadAndPost() {
    if (!auth.currentUser) return alert("ဦးစွာ Login ဝင်ပေးပါ");
    
    const text = document.getElementById('postContent').value.trim();
    const file = document.getElementById('mediaInput').files[0];
    const btn = document.getElementById('btnPost');
    
    if (!text.trim() && !file) {
        alert("Please enter text or select a file to post");
        return;
    }
    
    if (file && file.type.startsWith("video") && file.size > MAX_VIDEO_SIZE) {
        alert(`Video file size is too large! Maximum allowed size is 20MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
        return;
    }
    
    btn.disabled = true;
    btn.innerText = "Posting...";
    
    try {
        let mediaUrl = ""; 
        let mediaType = "none";
        
        if (file) {
            const fileName = Date.now() + "_" + file.name.replace(/\s+/g, "_");
            if (file.type.startsWith("video")) {
                await fetch(`https://sg.storage.bunnycdn.com/${BUNNY_STORAGE}/${fileName}`, {
                    method: "PUT", 
                    headers: { "AccessKey": BUNNY_KEY }, 
                    body: file
                });
                mediaUrl = `https://public-hospitals.b-cdn.net/${fileName}`;
                mediaType = "video";
            } else {
                const fd = new FormData(); 
                fd.append("image", file);
                const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { 
                    method: "POST", 
                    body: fd 
                });
                const d = await res.json();
                mediaUrl = d.data.url; 
                mediaType = "image";
            }
        }
        
        await db.collection("health_posts").add({
            author: auth.currentUser.displayName || auth.currentUser.phoneNumber || "User",
            authorId: auth.currentUser.uid,
            text, 
            mediaUrl, 
            mediaType,
            likes: 0, 
            hahas: 0, 
            likedBy: [], 
            hahaedBy: [], 
            comments: [],
            createdAt: Date.now()
        });
        
        document.getElementById('postContent').value = "";
        document.getElementById('mediaInput').value = "";
        const preview = document.getElementById('mediaPreviewBox');
        if(preview) {
            preview.style.display = "none";
            preview.innerHTML = "";
        }
    } catch (e) { 
        alert("Post Error: " + e.message); 
    }
    
    btn.disabled = false;
    btn.innerText = "Post";
}

// ၇။ Other Functions
async function deletePost(id) {
    if (!hasAdminPrivileges()) {
        alert("Admin access required!");
        return;
    }
    
    if(confirm("ပို့စ်ကို ဖျက်မှာ သေချာပါသလား?")) {
        await db.collection("health_posts").doc(id).delete();
    }
}

async function deleteComment(postId, index) {
    if (!hasAdminPrivileges()) {
        alert("Admin access required!");
        return;
    }
    
    if(!confirm("မှတ်ချက်ကို ဖျက်မှာ သေချာပါသလား?")) return;
    
    const ref = db.collection("health_posts").doc(postId);
    const snap = await ref.get();
    const postData = snap.data();
    const comments = postData.comments || [];
    comments.splice(index, 1);
    await ref.update({ comments });
}

function hasAdminPrivileges() {
    const user = auth.currentUser;
    if (!user) return false;
    const isAdminByEmail = user.email === ADMIN_EMAIL;
    return isAdminByEmail && isAdminVerified;
}

// ၈။ Helper Functions
function initRecaptcha() {
    recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        'size': 'normal',
        'callback': function(response) {
            console.log("reCAPTCHA verified");
        }
    });
}

function verifyAdminPin() {
    const pinInput = document.getElementById('adminPinInput');
    const pin = pinInput.value;
    
    if (pin === ADMIN_PIN) {
        isAdminVerified = true;
        alert("Admin PIN verified!");
        pinInput.value = '';
        loadPosts();
    } else {
        alert("Invalid admin PIN");
        isAdminVerified = false;
    }
}