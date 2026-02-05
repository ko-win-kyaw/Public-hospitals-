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
const ADMIN_PIN = "123456"; // Admin PIN code
const IMGBB_KEY = "C8d8d00185e973ebcafddd34f77a1176"; 
const BUNNY_KEY = "a038d7e1-bf94-448b-b863c156422e-7e4a-4299"; 
const BUNNY_STORAGE = "public-hospitals";

// Video size limit (20MB in bytes)
const MAX_VIDEO_SIZE = 20 * 1024 * 1024; // 20MB

let currentRating = 0;
let isAdminVerified = false; // PIN verification status
let recaptchaVerifier;

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
        
        // Check if user is admin by email
        if (user.email === ADMIN_EMAIL && adminBadge) {
            adminBadge.style.display = 'inline-block';
            // Show admin PIN section for admin users
            if(adminPinSection) adminPinSection.style.display = 'block';
        }
    } else {
        if(nameDisplay) nameDisplay.innerText = "ဧည့်သည် (Guest)";
        if(googleBtn) googleBtn.style.display = 'block';
        if(phoneLoginBtn) phoneLoginBtn.style.display = 'block';
        if(adminPinSection) adminPinSection.style.display = 'none';
        isAdminVerified = false; // Reset admin verification on logout
    }
    startApp();
    loadRatings();
    initRecaptcha();
});

// Initialize reCAPTCHA for phone auth
function initRecaptcha() {
    recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        'size': 'normal',
        'callback': function(response) {
            console.log("reCAPTCHA verified");
        }
    });
}

// Google Login
async function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try { 
        await auth.signInWithPopup(provider); 
    } catch (e) { 
        alert("Google Login Error: " + e.message); 
    }
}

// Phone Login System
function showPhoneLogin() {
    document.getElementById('phoneLoginModal').style.display = 'block';
}

function closePhoneLogin() {
    document.getElementById('phoneLoginModal').style.display = 'none';
}

async function sendOTP() {
    const phoneNumber = document.getElementById('phoneNumber').value;
    const phoneNumberWithCode = "+95" + phoneNumber; // Myanmar phone code
    
    if (!phoneNumber || phoneNumber.length < 9) {
        alert("Please enter a valid phone number");
        return;
    }
    
    try {
        const confirmationResult = await auth.signInWithPhoneNumber(
            phoneNumberWithCode, 
            recaptchaVerifier
        );
        window.confirmationResult = confirmationResult;
        document.getElementById('otpSection').style.display = 'block';
        document.getElementById('sendOTPBtn').style.display = 'none';
        alert("OTP sent to your phone!");
    } catch (e) {
        alert("OTP Send Error: " + e.message);
        console.error(e);
    }
}

async function verifyOTP() {
    const otp = document.getElementById('otpCode').value;
    
    if (!otp || otp.length < 6) {
        alert("Please enter a valid OTP");
        return;
    }
    
    try {
        const result = await window.confirmationResult.confirm(otp);
        alert("Phone login successful!");
        closePhoneLogin();
        document.getElementById('phoneNumber').value = '';
        document.getElementById('otpCode').value = '';
        document.getElementById('otpSection').style.display = 'none';
        document.getElementById('sendOTPBtn').style.display = 'block';
    } catch (e) {
        alert("OTP Verification Error: " + e.message);
    }
}

// Admin PIN Verification
async function verifyAdminPin() {
    const pinInput = document.getElementById('adminPinInput');
    const pin = pinInput.value;
    
    if (!pin) {
        alert("Please enter admin PIN");
        return;
    }
    
    if (pin === ADMIN_PIN) {
        isAdminVerified = true;
        alert("Admin PIN verified! You now have admin privileges.");
        pinInput.value = '';
        updateAdminUI();
    } else {
        alert("Invalid admin PIN");
        isAdminVerified = false;
    }
}

function updateAdminUI() {
    const adminControls = document.getElementById('adminControls');
    if (adminControls) {
        adminControls.style.display = isAdminVerified ? 'block' : 'none';
    }
}

// Check if user has admin privileges (both email and PIN verified)
function hasAdminPrivileges() {
    const user = auth.currentUser;
    if (!user) return false;
    
    const isAdminByEmail = user.email === ADMIN_EMAIL;
    return isAdminByEmail && isAdminVerified;
}

// ၃။ Rating စနစ်
function setRating(num) {
    currentRating = num;
    const stars = document.querySelectorAll('#ratingStars span');
    stars.forEach((s, i) => { s.style.color = i < num ? "orange" : "gray"; });
}

async function submitFeedback() {
    if (!auth.currentUser) return alert("ဦးစွာ Login ဝင်ပေးပါ");
    if (currentRating === 0) return alert("Rating (ကြယ်ပွင့်) အရင်ရွေးပေးပါ");
    try {
        await db.collection("app_ratings").doc(auth.currentUser.uid).set({
            userName: auth.currentUser.displayName || auth.currentUser.phoneNumber || "User",
            rating: currentRating,
            feedback: document.getElementById('feedbackText').value,
            timestamp: Date.now()
        });
        alert("Rating ပေးပြီးပါပြီ!");
        document.getElementById('feedbackText').value = '';
        setRating(0); // Reset stars
    } catch (e) { alert(e.message); }
}

async function loadRatings() {
    db.collection("app_ratings").onSnapshot(snap => {
        let total = 0, counts = {1:0, 2:0, 3:0, 4:0, 5:0};
        snap.forEach(doc => {
            let r = doc.data().rating;
            if(counts[r] !== undefined) counts[r]++;
            total += r;
        });
        let avg = snap.size > 0 ? (total / snap.size).toFixed(1) : "0.0";
        const el = document.getElementById('averageRatingDisplay');
        if(el) el.innerText = "⭐ " + avg;
        
        // Update rating distribution
        for (let i = 1; i <= 5; i++) {
            const distEl = document.getElementById(`ratingDist${i}`);
            if (distEl) {
                const count = counts[i] || 0;
                const percentage = snap.size > 0 ? ((count / snap.size) * 100).toFixed(0) : 0;
                distEl.innerText = `${i} star: ${count} (${percentage}%)`;
            }
        }
    });
}

// ၄။ News Feed & Display
function startApp() {
    db.collection("health_posts").orderBy("createdAt", "desc").onSnapshot(snap => {
        const feed = document.getElementById('newsFeed');
        if (!feed) return;
        let html = "";
        const uid = auth.currentUser ? auth.currentUser.uid : "visitor";

        snap.forEach(doc => {
            const d = doc.data(); const id = doc.id;
            const isLiked = (d.likedBy || []).includes(uid);
            const isHahaed = (d.hahaedBy || []).includes(uid);

            let comms = (d.comments || []).map((c, i) => {
                const cLiked = (c.likedBy || []).includes(uid);
                const cHahaed = (c.hahaedBy || []).includes(uid);
                
                // Only admin can delete comments (user comment delete removed)
                const canDeleteComment = hasAdminPrivileges();
                
                return `
                <div style="background:#f0f2f5; margin-bottom:8px; padding:10px; border-radius:10px; font-size:13px; color:black; position:relative;">
                    <b>${c.author}</b>: ${c.text}
                    ${canDeleteComment ? `<span onclick="deleteComment('${id}', ${i})" style="position:absolute; right:10px; top:5px; color:red; cursor:pointer; font-size:11px;">[Delete]</span>` : ''}
                    <div style="margin-top:5px; display:flex; gap:12px;">
                        <span onclick="reactComment('${id}', ${i}, 'likes')" style="cursor:pointer; color:${cLiked?'blue':'gray'}">👍 ${c.likes||0}</span>
                        <span onclick="reactComment('${id}', ${i}, 'hahas')" style="cursor:pointer; color:${cHahaed?'orange':'gray'}">😆 ${c.hahas||0}</span>
                    </div>
                </div>`;
            }).join('');

            // Check if user can delete post (admin only)
            const canDeletePost = hasAdminPrivileges();
            
            html += `
                <div class="card" style="background:white; margin-bottom:15px; padding:15px; border-radius:12px; color:black; text-align:left; box-shadow:0 1px 3px rgba(0,0,0,0.1); position:relative;">
                    ${canDeletePost ? `<button onclick="deletePost('${id}')" style="position:absolute; right:10px; top:10px; color:red; border:none; background:none; font-weight:bold; cursor:pointer;">[Delete Post]</button>` : ''}
                    <b style="color:purple; font-size:16px;">${d.author}</b>
                    <p style="margin:10px 0; white-space:pre-wrap;">${d.text || ""}</p>
                    ${d.mediaType === 'video' ? `<video controls playsinline style="width:100%; max-height:400px; border-radius:8px; background:black;"><source src="${d.mediaUrl}"></video>` : ''}
                    ${d.mediaType === 'image' ? `<img src="${d.mediaUrl}" style="width:100%; max-height:400px; border-radius:8px; object-fit:cover;">` : ''}
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

// ၅။ Logic Functions (Reactions & Comments)
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

async function reactComment(postId, index, type) {
    if (!auth.currentUser) return alert("ဦးစွာ Login ဝင်ပေးပါ");
    const ref = db.collection("health_posts").doc(postId);
    
    return db.runTransaction(async (transaction) => {
        const sfDoc = await transaction.get(ref);
        if (!sfDoc.exists) return;
        let comments = [...sfDoc.data().comments];
        let c = comments[index];
        const uid = auth.currentUser.uid;
        const field = type === "likes" ? "likedBy" : "hahaedBy";
        const count = type === "likes" ? "likes" : "hahas";

        if (!c[field]) c[field] = [];
        if (c[field].includes(uid)) {
            c[field] = c[field].filter(x => x !== uid);
            c[count] = Math.max(0, (c[count] || 1) - 1);
        } else {
            c[field].push(uid);
            c[count] = (c[count] || 0) + 1;
        }
        transaction.update(ref, { comments });
    });
}

async function addComment(id) {
    const el = document.getElementById(`in-${id}`);
    if (!el.value.trim() || !auth.currentUser) return alert("မှတ်ချက်ရေးရန် Login ဝင်ပေးပါ");
    await db.collection("health_posts").doc(id).update({
        comments: firebase.firestore.FieldValue.arrayUnion({
            author: auth.currentUser.displayName || auth.currentUser.phoneNumber || "User",
            authorId: auth.currentUser.uid,
            text: el.value, 
            likes: 0, 
            hahas: 0, 
            likedBy: [], 
            hahaedBy: [], 
            createdAt: Date.now()
        })
    });
    el.value = "";
}

// ၆။ Media & Post Control
async function uploadAndPost() {
    if (!auth.currentUser) return alert("ဦးစွာ Login ဝင်ပေးပါ");
    
    const text = document.getElementById('postContent').value.trim();
    const file = document.getElementById('mediaInput').files[0];
    const btn = document.getElementById('btnPost');

    // Check if post has content
    if (!text.trim() && !file) {
        alert("Please enter text or select a file to post");
        return;
    }

    // Check video file size
    if (file && file.type.startsWith("video") && file.size > MAX_VIDEO_SIZE) {
        alert(`Video file size is too large! Maximum allowed size is 20MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
        btn.disabled = false;
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
                // Video upload to BunnyCDN
                const uploadResponse = await fetch(`https://sg.storage.bunnycdn.com/${BUNNY_STORAGE}/${fileName}`, {
                    method: "PUT", 
                    headers: { "AccessKey": BUNNY_KEY }, 
                    body: file
                });
                
                if (!uploadResponse.ok) {
                    throw new Error("Video upload failed");
                }
                
                mediaUrl = `https://public-hospitals.b-cdn.net/${fileName}`;
                mediaType = "video";
            } else {
                // Image upload to ImgBB
                const fd = new FormData(); 
                fd.append("image", file);
                const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { 
                    method: "POST", 
                    body: fd 
                });
                const d = await res.json();
                
                if (!d.success) {
                    throw new Error("Image upload failed");
                }
                
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
        
        // Reset form
        document.getElementById('postContent').value = "";
        document.getElementById('mediaInput').value = "";
        const preview = document.getElementById('mediaPreviewBox');
        if(preview) {
            preview.style.display = "none";
            preview.innerHTML = "";
        }
        alert("ပို့စ်တင်ပြီးပါပြီ");
    } catch (e) { 
        alert("Post Error: " + e.message); 
        console.error(e);
    }
    
    btn.disabled = false;
    btn.innerText = "Post";
}

function previewMedia(input) {
    const box = document.getElementById('mediaPreviewBox');
    if (input && input.files && input.files[0]) {
        const file = input.files[0];
        let fileInfo = `ရွေးထားသောဖိုင်: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB)`;
        
        // Add warning for large video files
        if (file.type.startsWith("video") && file.size > MAX_VIDEO_SIZE) {
            fileInfo += ` <span style="color:red;">⚠️ Video size exceeds 20MB limit!</span>`;
        }
        
        // Show preview for images
        if (file.type.startsWith("image")) {
            const reader = new FileReader();
            reader.onload = function(e) {
                fileInfo += `<br><img src="${e.target.result}" style="max-width:200px; max-height:200px; margin-top:10px; border-radius:8px;">`;
                box.innerHTML = fileInfo;
            }
            reader.readAsDataURL(file);
        } else {
            box.innerHTML = fileInfo;
        }
        
        box.style.display = 'block';
    }
}

async function deletePost(id) {
    // Check admin privileges
    if (!hasAdminPrivileges()) {
        alert("Admin access required!");
        return;
    }
    
    if(confirm("ပို့စ်ကို ဖျက်မှာ သေချာပါသလား?")) {
        await db.collection("health_posts").doc(id).delete();
    }
}

async function deleteComment(postId, index) {
    // Check admin privileges
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

// Logout function
function logout() {
    if (confirm("Logout လုပ်မှာ သေချာပါသလား?")) {
        auth.signOut().then(() => {
            isAdminVerified = false;
            alert("Logout successful!");
        }).catch((error) => {
            alert("Logout error: " + error.message);
        });
    }
}