const firebaseConfig = {
    apiKey: "AIzaSyD4Yiez3VXKD90za0wnt03lFPjeln4su7U",
    authDomain: "hospital-app-caf85.firebaseapp.com",
    projectId: "hospital-app-caf85",
    storageBucket: "hospital-app-caf85.firebasestorage.app",
    messagingSenderId: "736486429191",
    appId: "1:736486429191:web:25c116beb3994d213cd0a2"
};

// Firebase ကို တစ်ခါပဲ Init လုပ်ရန်
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();

// --- Configuration ---
const ADMIN_EMAIL = "uwinkyawdevelopbusinessco@gmail.com"; 
const IMGBB_KEY = "C8d8d00185e973ebcafddd34f77a1176"; 
const BUNNY_KEY = "a038d7e1-bf94-448b-b863c156422e-7e4a-4299"; 
const BUNNY_STORAGE = "public-hospitals";
// Listener အပြင်ဘက်မှာ ထားပေးပါ (Memory ထဲမှာ မှတ်ထားဖို့အတွက်)
const processedNotis = new Set();

function startLiveNotifications() {
    if (!auth.currentUser) return;
    const myUid = auth.currentUser.uid;

    // ၁။ Database ထဲက "unread" Noti များကို စောင့်ကြည့်မယ်
    db.collection("notifications")
      .where("receiverId", "==", myUid)
      .where("status", "==", "unread")
      .onSnapshot(snap => {
          snap.docChanges().forEach(change => {
              const notiId = change.doc.id;

              // ၂။ Logic Check: အသစ်တိုးလာတာဖြစ်ရမယ်၊ လက်ရှိ Session ထဲမှာ Process မလုပ်ရသေးတာ ဖြစ်ရမယ်
              if (change.type === "added" && !processedNotis.has(notiId)) {
                  
                  // ၃။ Loop မပတ်အောင် ချက်ချင်း ID ကို မှတ်သားလိုက်ပါ
                  processedNotis.add(notiId);
                  
                  const d = change.doc.data();

                  // ၄။ Browser Notification ပြသခြင်း (Senior ရဲ့ ImgBB Logo Link ဖြင့်)
                  if (Notification.permission === "granted") {
                      const n = new Notification(d.title, { 
                          body: d.body,
                          icon: "https://i.ibb.co/RkJCm6CV/Gallery-1772168024425.jpg", // ✅ Senior ရဲ့ ImgBB Logo Link
                          tag: notiId // System level duplicate ကို တားဆီးရန်
                      });

                      // ၅။ Notification Click Logic
                      n.onclick = function(event) {
                          event.preventDefault();
                          window.focus(); 
                          if (d.postId) {
                              scrollToPost(d.postId); // Post ရှိရာသို့ Scroll ဆွဲမည်
                          }
                          this.close();
                      };
                      
                      // 🌟 အသံပါ ထည့်ချင်ရင် ဒီအောက်မှာ audio.play() ထည့်နိုင်ပါတယ်
                  }

                  // ၆။ Database မှာ "read" အဖြစ် Update လုပ်မယ်
                  // ဤနေရာတွင် update လုပ်သော်လည်း Set ထဲမှာ id ရှိနေ၍ Listener က ထပ်မပြတော့ပါ (Loop တားဆီးပြီးသား)
                  db.collection("notifications").doc(notiId).update({ 
                      status: "read" 
                  }).then(() => {
                      console.log(`✅ Noti ${notiId} marked as read`);
                      
                      // ၇။ Memory Cleanup: ၁ မိနစ်ကြာရင် Set ထဲက ပြန်ထုတ်မယ် (Option)
                      setTimeout(() => processedNotis.delete(notiId), 60000); 
                  }).catch(e => {
                      console.error("Update Noti Error:", e);
                      // Update Error တက်ရင် နောက်တစ်ခါ ပြန်ပြနိုင်အောင် Set ထဲက ပြန်ဖျက်ပေးပါ
                      processedNotis.delete(notiId);
                  });
              }
          });
      });
}

function getDisplayNameWithBadge(d) {
    if (!d) return "Anonymous";
    let badge = "";
    if (d.isCrown === true) {
        badge = ` <span class="badge-official crown-bg" style="font-size:10px; padding:2px 5px; vertical-align:middle; white-space:nowrap;">👑 Official</span>`;
    } else if (d.isGold === true) {
        badge = ` <span class="badge-official gold-bg" style="font-size:10px; padding:2px 5px; vertical-align:middle; white-space:nowrap;">$ Verified</span>`;
    }
    // အမည်ဘေးမှာ Badge ကို တန်းစီပြီး ကပ်ပေးမယ့် Logic ပါ
    return `<span style="display:inline-flex; align-items:center; gap:4px;">${d.author || d.displayName || "User"}${badge}</span>`;
}

async function getMyDeviceId() {
    try {
        // Library ရှိမရှိစစ်ခြင်း
        if (typeof FingerprintJS === 'undefined') {
            console.warn("FingerprintJS library is missing!");
            return "unknown_device_id";
        }
        
        // Fingerprint agent ကို load လုပ်ပြီး ID ယူခြင်း
        const fpPromise = FingerprintJS.load();
        const fp = await fpPromise;
        const result = await fp.get();
        return result.visitorId; // တိကျတဲ့ Device ID ကို return ပြန်ပေးပါမယ်
    } catch (e) { 
        console.error("Fingerprint Error:", e);
        return "error_generating_id"; 
    }
}
// ၁။ Video Auto-play/Pause Observer (နဂိုအတိုင်း ၈၀% မြင်ရမှ ဖွင့်မည်)
const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const video = entry.target;
        if (entry.intersectionRatio < 0.8) {
            video.pause();
        } else {
            // Auto-play block ဖြစ်ခြင်းကို handle လုပ်ထားသည်
            video.play().catch(e => console.log("Auto-play blocked by browser policy"));
        }
    });
}, { threshold: [0.8] });

// ၂။ Post View Counter Observer (ပိုမိုကောင်းမွန်အောင် ပြင်ဆင်ထားသည်)
const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const postId = entry.target.getAttribute('data-id');
            const isAlreadyViewedLocally = localStorage.getItem(`viewed_${postId}`);

            // HTML မှာ viewed attribute မရှိသေးရင်ရော၊ localStorage မှာ မရှိသေးရင်ရော စစ်မည်
            if (postId && entry.target.getAttribute('data-viewed') !== "true" && !isAlreadyViewedLocally) {
                
                // Views တိုးသည့် function ကို လှမ်းခေါ်မည်
                incrementView(postId);
                
                // UI မှာ တစ်ခါတည်း tag မှတ်မည်
                entry.target.setAttribute('data-viewed', "true");
                
                // ဒီ Element ကို ဆက်ကြည့်နေစရာမလိုတော့၍ ရပ်ခိုင်းမည် (Performance boost)
                scrollObserver.unobserve(entry.target);
            }
        }
    });
}, { threshold: 0.5 }); // Post ၏ ၅၀% ကို မြင်ကွင်းထဲရောက်လျှင် View အဖြစ်သတ်မှတ်မည်

// Function အသစ်များကို Element များတွင် စတင်အသုံးပြုစေရန်

function observeElements() {
    document.querySelectorAll('video').forEach(v => videoObserver.observe(v));
    document.querySelectorAll('.post-card').forEach(post => scrollObserver.observe(post));
}
// ၁။ Global Variable ကို JS အပေါ်ဆုံးမှာ ကြေညာထားပါ
let currentUserData = null; 

let isAdmin = false; // ၁။ Global variable ကြေညာခြင်း


auth.onAuthStateChanged(async (user) => {
    console.log("🛠️ Auth Process Start...");
    const nameDisplay = document.getElementById('userNameDisplay');
    const nameModal = document.getElementById('nameSetupModal');
    
    if (user) {
        // ၂။ Global Admin Check သတ်မှတ်ခြင်း
        isAdmin = user.email === "uwinkyawdevelopbusinessco@gmail.com";
        
        // ၃။ Notification Permission တောင်းခြင်း
        if (typeof requestNotificationPermission === 'function') {
            requestNotificationPermission();
        }

        try {
            // ၄။ Device ID ရယူခြင်း
            const currentDevId = await Promise.race([
                getMyDeviceId(),
                new Promise(resolve => setTimeout(() => resolve("timeout_id"), 5000))
            ]);

            const userRef = db.collection("users").doc(user.uid);
            const doc = await userRef.get();

            let needsUpdate = false;
            let updatePayload = {};

            if (doc.exists) {
                const existingData = doc.data();
                currentUserData = existingData;

                // ၅။ Ban Status စစ်ခြင်း
                if (existingData.isBanned) {
                    alert("သင့်အကောင့်သည် ပိတ်ပင်ခံထားရပါသည်။");
                    await auth.signOut();
                    return;
                }

                // ၆။ Device Lock စစ်ခြင်း (Admin မဟုတ်လျှင်)
                if (!isAdmin && currentDevId !== "timeout_id" && existingData.deviceId && existingData.deviceId !== currentDevId) {
                    alert("Account Error: ဤအကောင့်ကို အခြားဖုန်းတွင် သုံးထားပြီးသားဖြစ်သည်။");
                    await auth.signOut();
                    return; 
                }

                // ၇။ Database Writes သက်သာစေရန် လိုအပ်မှသာ Update လုပ်မည့် Logic
                const lastActive = existingData.lastActive ? existingData.lastActive.toMillis() : 0;
                const fiveMinsAgo = Date.now() - (5 * 60 * 1000);

                if (!existingData.deviceId && currentDevId !== "timeout_id") {
                    updatePayload.deviceId = currentDevId;
                    needsUpdate = true;
                }
                
                if (lastActive < fiveMinsAgo) {
                    updatePayload.lastActive = firebase.firestore.FieldValue.serverTimestamp();
                    needsUpdate = true;
                }
            } else {
                // User အသစ် Register လုပ်ခြင်း
                needsUpdate = true;
                updatePayload = {
                    uid: user.uid,
                    displayName: user.displayName || "User_" + user.uid.substring(0,5),
                    deviceId: currentDevId !== "timeout_id" ? currentDevId : null,
                    lastActive: firebase.firestore.FieldValue.serverTimestamp(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    isAutoFriendAdded: false
                };
            }

            if (needsUpdate) {
                await userRef.set(updatePayload, { merge: true });
                currentUserData = { ...currentUserData, ...updatePayload };
                console.log("✅ User profile synced.");
            }

            // ၈။ Auto Friend System
            const isAlreadyAdded = (doc.exists && doc.data().isAutoFriendAdded) || false;
            if (!isAlreadyAdded && typeof startAutoFriendSystem === 'function') {
                await startAutoFriendSystem(user.uid);
            }

            // ၉။ UI Setup (Name Badge & Modal)
            if (!user.displayName || !isSafeName(user.displayName)) {
                if(nameModal) nameModal.style.display = 'flex';
            } else {
                if(nameModal) nameModal.style.display = 'none';
                if(nameDisplay) nameDisplay.innerHTML = getDisplayNameWithBadge(currentUserData);
            }

            // ၁၀။ Live Listeners စတင်ခြင်း
            if(typeof startLiveNotifications === 'function') startLiveNotifications();

        } catch (e) {
            console.error("❌ Auth Error:", e);
        }
    } else {
        // Guest Mode
        isAdmin = false;
        currentUserData = null;
        if (nameDisplay) nameDisplay.innerText = "ဧည့်သည် (Guest)";
    }
    
    // ၁၁။ Post များ ဆွဲတင်ခြင်း (တစ်ကြိမ်သာ)
    if (!window.postsLoaded) { 
        loadPosts(); 
        window.postsLoaded = true; 
    }
});

// Notification Permission Function
async function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
    }
}

async function handleReact(postId, type, collection = "health_posts") {
    // ၁။ User Login ဝင်ထားခြင်း ရှိမရှိ အရင်စစ်မည်
    if (!auth.currentUser) {
        return alert("ဒီ post ကို react ပေးဖို့ Login အရင်ဝင်ပါ Senior");
    }
    
    const uid = auth.currentUser.uid;
    const ref = db.collection(collection).doc(postId);
    
    try {
        // ၂။ Database မှ လက်ရှိ Post data ကို ရယူမည်
        const snap = await ref.get();
        if (!snap.exists) return;
        
        const data = snap.data();
        
        // ၃။ Field Name များကို သတ်မှတ်မည်
        const isLike = type === 'likes';
        const field = isLike ? 'likedBy' : 'hahaedBy';
        const countField = isLike ? 'likes' : 'hahas';

        // ၄။ အရင်ပေးထားပြီးသားလား စစ်ဆေးမည် (Array မရှိသေးပါက empty array ဖြင့် အစားထိုးမည်)
        const userList = data[field] || [];
        const isAlreadyReacted = userList.includes(uid);

        // ၅။ Firestore Transaction သို့မဟုတ် Update လုပ်ခြင်း
        if (isAlreadyReacted) {
            // Reaction ပြန်ဖြုတ်ခြင်း (Unlike / Un-haha)
            await ref.update({
                [field]: firebase.firestore.FieldValue.arrayRemove(uid),
                [countField]: firebase.firestore.FieldValue.increment(-1)
            });
            console.log(`✅ ${type} removed`);
        } else {
            // Reaction အသစ်ပေးခြင်း (Like / Haha)
            await ref.update({
                [field]: firebase.firestore.FieldValue.arrayUnion(uid),
                [countField]: firebase.firestore.FieldValue.increment(1)
            });
            console.log(`✅ ${type} added`);
            
            // Notification Logic (Option): Post ပိုင်ရှင်ကို Notification ပို့ချင်ရင် ဒီနေရာမှာ ထည့်နိုင်ပါတယ်
        }

    } catch (e) {
        console.error("❌ React Process Error:", e);
        alert("Reaction ပေးလို့မရဖြစ်နေပါတယ် Senior။ ခဏနေမှ ပြန်ကြိုးစားကြည့်ပါ။");
    }
}
function loadPosts() {
    const feed = document.getElementById('newsFeed');
    if (!feed) return;

    // Real-time Listener
    db.collection("health_posts").orderBy("createdAt", "desc").onSnapshot(snap => {
        const uid = auth.currentUser ? auth.currentUser.uid : "visitor";
        const isAdmin = auth.currentUser?.email === ADMIN_EMAIL;

        snap.docChanges().forEach(change => {
            const id = change.doc.id;
            const d = change.doc.data();
            let postEl = document.getElementById(`post-${id}`);

            // ၁။ Post အသစ်တက်လာလျှင် (Added)
            if (change.type === "added" && !postEl) {
                const div = document.createElement('div');
                div.id = `post-${id}`;
                div.className = "post-card";
                div.setAttribute('data-id', id);
                div.style = `background:white; margin-bottom:15px; padding:15px; border-radius:12px; color:black; border:${d.isPinned ? '2px solid purple' : 'none'}; box-shadow: 0 2px 5px rgba(0,0,0,0.1); position:relative;`;

                // renderPostHTML function ထဲသို့ data ပို့ခြင်း
                div.innerHTML = renderPostHTML(id, d, uid, isAdmin);
                
                // Pin ထားလျှင် ထိပ်ဆုံးပို့၊ မဟုတ်လျှင် အပေါ်ဆုံးကနေ တန်းစီထည့် (prepend)
                if (d.isPinned) {
                    feed.prepend(div); 
                } else {
                    // post အသစ်တွေကို အပေါ်ဆုံးမှာ မြင်ရအောင် prepend သုံးပါသည်
                    feed.prepend(div); 
                }
            }

            // ၂။ Post ထဲက Data ပြောင်းလဲလျှင် (Modified)
            else if (change.type === "modified" && postEl) {
                const isLiked = (d.likedBy || []).includes(uid);
                const isHahaed = (d.hahaedBy || []).includes(uid);

                // Reaction & Stats updates
                const reactionArea = postEl.querySelector('.action-bar-content');
                if (reactionArea) {
                    reactionArea.innerHTML = `
                        <span onclick="handleReact('${id}', 'likes')" style="cursor:pointer; font-weight:bold; color:${isLiked ? '#007bff' : 'gray'}; font-size:14px; display:flex; align-items:center; gap:4px;">👍 Like (${d.likes || 0})</span>
                        <span onclick="handleReact('${id}', 'hahas')" style="cursor:pointer; font-weight:bold; color:${isHahaed ? '#f7b928' : 'gray'}; font-size:14px; display:flex; align-items:center; gap:4px;">😆 Haha (${d.hahas || 0})</span>
                    `;
                }

                const statArea = postEl.querySelector('.stat-content');
                if (statArea) {
                    statArea.innerHTML = `👁️ ${d.views || 0} | <span onclick="handleShare('${id}')" style="cursor:pointer; color:purple; font-weight:bold;">🚀 Share (${d.shares || 0})</span>`;
                }

                const commArea = document.getElementById(`comms-${id}`);
                if (commArea) {
                    commArea.innerHTML = renderComments(id, d.comments, isAdmin, uid);
                }

                postEl.style.border = d.isPinned ? '2px solid purple' : 'none';
            }

            // ၃။ Post ဖျက်လိုက်လျှင် (Removed)
            else if (change.type === "removed" && postEl) {
                postEl.remove();
            }
        });

        // Video သို့မဟုတ် View Observers များအတွက် Update
        if (snap.docChanges().some(c => c.type === "added")) {
            setTimeout(() => {
                if (typeof observeElements === "function") observeElements();
            }, 300);
        }
    });
}


function formatTime(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return "ခုနကတင်";
    if (diff < 3600) return Math.floor(diff / 60) + " မိနစ်ခန့်က";
    if (diff < 86400) return Math.floor(diff / 3600) + " နာရီခန့်က";
    if (diff < 172800) return "မနေ့က";
    
    // ၂ ရက်ထက်ကျော်ရင် ရက်စွဲအတိုင်းပြမယ်
    return date.toLocaleDateString('my-MM', { day: 'numeric', month: 'short', year: 'numeric' });
}
function renderPostHTML(id, d, uid, isAdmin) {
    // ၁။ Reaction နှင့် အချိန် Logic
    const isLiked = (d.likedBy || []).includes(uid);
    const isHahaed = (d.hahaedBy || []).includes(uid);
    const timeDisplay = formatTime(d.createdAt);

    // ၂။ Media Logic (Bunny URL double-path ဖြစ်ခြင်းကို ရှင်းလင်းထားသည်)
    let mediaHTML = "";
    const mediaItems = d.media || (d.mediaUrl ? [{url: d.mediaUrl, type: d.mediaType || 'image'}] : []);

    mediaItems.forEach(m => {
        if (m.type === 'video' || m.url.toLowerCase().includes('.mp4')) {
            // Senior ပြောသလို m.url ကို တန်းသုံးလိုက်ရုံပါပဲ (replace logic ဖယ်လိုက်ပါပြီ)
            mediaHTML += `
                <div style="margin-top:10px; background:#000; border-radius:12px; overflow:hidden;">
                    <video onplay="incrementView('${id}')" controls playsinline preload="metadata" style="width:100%; display:block; max-height:400px;">
                        <source src="${m.url}" type="video/mp4">
                    </video>
                </div>`;
        } else {
            mediaHTML += `
                <img onclick="incrementView('${id}')" src="${m.url}" 
                     style="width:100%; border-radius:12px; margin-top:10px; display:block; cursor:pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">`;
        }
    });

    // ၃။ Full UI Layout (Admin actions မှာ Ban ခလုတ် 🚫 အသစ် ထည့်သွင်းထားသည်)
    return `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
            <div style="display: flex; flex-direction: column; flex: 1; min-width: 0;">
                <b style="color: purple; font-size: 15px; display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                    ${getDisplayNameWithBadge(d)}
                </b>
                <small style="color: gray; font-size: 11px;">${timeDisplay}</small>
            </div>
            
            <div style="display: flex; gap: 12px; flex-shrink: 0; margin-left: 10px; align-items: center;">
                ${isAdmin ? `
                    <span onclick="togglePin('${id}', ${d.isPinned || false})" style="cursor:pointer; font-size: 18px;" title="Pin Post">
                        ${d.isPinned ? '📌' : '📍'}
                    </span>
                    <span onclick="banUser('${d.uid}', '${d.author || "User"}')" style="cursor:pointer; font-size: 18px;" title="Ban User">
                        🚫
                    </span>
                    <span onclick="deletePost('health_posts', '${id}')" style="cursor:pointer; font-size: 18px;" title="Delete Post">
                        🗑️
                    </span>
                ` : ''}
            </div>
        </div>

        <p style="margin: 8px 0 12px 0; white-space: pre-wrap; font-size: 14.5px; text-align: left; color: #222; line-height: 1.5;">${d.text || ""}</p>
        
        ${mediaHTML}
        
        <div style="display: flex; justify-content: space-between; margin-top: 15px; border-top: 1px solid #f0f0f0; padding-top: 12px;">
            <div class="action-bar-content" style="display: flex; gap: 20px;">
                <span onclick="handleReact('${id}', 'likes')" style="cursor:pointer; font-weight:bold; color:${isLiked?'#007bff':'#65676b'}; font-size:14px; display:flex; align-items:center; gap:4px;">
                    👍 Like (${d.likes||0})
                </span>
                <span onclick="handleReact('${id}', 'hahas')" style="cursor:pointer; font-weight:bold; color:${isHahaed?'#f7b928':'#65676b'}; font-size:14px; display:flex; align-items:center; gap:4px;">
                    😆 Haha (${d.hahas||0})
                </span>
            </div>
            <div class="stat-content" style="font-size: 12.5px; color: #888;">
                👁️ ${d.views||0} | <span onclick="handleShare('${id}')" style="cursor:pointer; color:purple; font-weight:bold;">🚀 Share (${d.shares||0})</span>
            </div>
        </div>

        <div style="margin-top: 12px; background: #f8f9fa; border-radius: 10px; padding: 10px;">
            <div id="comms-${id}">${renderComments(id, d.comments, isAdmin, uid)}</div>
            
            <div style="display: flex; gap: 8px; margin-top: 10px; align-items: center;">
                <input type="text" id="in-${id}" placeholder="မှတ်ချက်ပေးရန်..." 
                       style="flex:1; border-radius: 20px; border: 1px solid #ddd; padding: 8px 15px; font-size: 13px; outline: none; background: white; box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);">
                <button onclick="addComment('${id}')" 
                        style="color: purple; border: none; background: none; font-weight: bold; cursor: pointer; font-size: 14px; padding: 5px 10px;">
                    Send
                </button>
            </div>
        </div>`;
}
async function addComment(id) {
    // ၁။ အခြေခံ Login Check လုပ်ခြင်း
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ Senior");
    
    const inputField = document.getElementById(`in-${id}`);
    const val = inputField.value.trim();
    if (!val) return;

    try {
        let isCrown = false;
        let isGold = false;

        // ၂။ Badge Logic (Global variable သို့မဟုတ် Firestore မှ ရယူခြင်း)
        if (typeof currentUserData !== 'undefined' && currentUserData !== null) {
            isCrown = currentUserData.isCrown || false;
            isGold = currentUserData.isGold || false;
        } else {
            const userDoc = await db.collection("users").doc(auth.currentUser.uid).get();
            const userData = userDoc.exists ? userDoc.data() : {};
            isCrown = userData.isCrown || false;
            isGold = userData.isGold || false;
        }

        // ၃။ ပေါင်းစည်းထားသော Comment Object (ID System ပါဝင်သည်)
        const newComment = {
            id: "c_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5), // Unique ID စနစ်
            uid: auth.currentUser.uid, 
            author: auth.currentUser.displayName || "User", 
            isCrown: isCrown, 
            isGold: isGold,   
            text: val,
            likes: 0, 
            likedBy: [], 
            hahas: 0, 
            hahaedBy: [], 
            createdAt: Date.now()
        };

        // ၄။ Firestore သို့ ပို့ခြင်း
        await db.collection("health_posts").doc(id).update({
            comments: firebase.firestore.FieldValue.arrayUnion(newComment)
        });

        // ၅။ UI Reset လုပ်ခြင်း (location.reload မပါဘဲ Form ကိုပဲ ရှင်းမည်)
        inputField.value = "";
        
        console.log("✅ Comment added with ID:", newComment.id);

    } catch (e) { 
        console.error("Comment Error:", e);
        alert("မှတ်ချက်ပေးလို့ မရဖြစ်နေပါတယ် Senior");
    }
}

function renderComments(postId, comments, isAdmin, uid) {
    if (!comments || comments.length === 0) return "";

    // ၁။ Like/Haha အများဆုံးကို ထိပ်ဆုံးပို့ရန် Sort လုပ်ခြင်း (နဂို logic အတိုင်း)
    const sortedComments = [...comments].sort((a, b) => {
        const scoreA = (a.likes || 0) + (a.hahas || 0);
        const scoreB = (b.likes || 0) + (b.hahas || 0);
        return scoreB - scoreA;
    });

    const limit = 5;
    const hasMore = sortedComments.length > limit;
    const displayedComments = sortedComments.slice(0, limit);
    const extraComments = sortedComments.slice(limit);

    // Helper Function: Comment တစ်ခုချင်းစီရဲ့ HTML ကို ထုတ်ပေးရန်
    const createCommentHTML = (c) => {
        // Top Comment ဟုတ်မဟုတ် စစ်ဆေးခြင်း
        const isTop = (sortedComments.indexOf(c) === 0 && ((c.likes || 0) + (c.hahas || 0) > 0));
        const authorWithBadge = getDisplayNameWithBadge(c);

        // ၂။ Premium Border & Background Logic (နဂိုအတိုင်း အပြည့်အစုံပါဝင်သည်)
        let premiumStyle = "border-left: 3px solid #ddd; background: #f0f2f5;"; 
        
        if (c.isCrown) {
            premiumStyle = "border: 1.5px solid #a332c3; background: #fdf5ff; box-shadow: 0 0 5px rgba(163, 50, 195, 0.1);";
        } else if (c.isGold) {
            premiumStyle = "border: 1.5px solid #f3b64d; background: #fffdf5; box-shadow: 0 0 5px rgba(243, 182, 77, 0.1);";
        } else if (isTop) {
            premiumStyle = "border-left: 4px solid #f3b64d; background: #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.05);";
        }

        // ✅ ပြင်ဆင်ချက်: reactComment နဲ့ deleteComment ခေါ်ဆိုမှုကို ID စနစ်သို့ ပြောင်းလဲထားသည်
        return `
        <div style="${premiumStyle} margin-bottom:8px; padding:10px; border-radius:10px; font-size:13px; text-align:left;">
            ${isTop ? '<small style="color:#d4af37; font-weight:bold;">🏆 Top Comment</small><br>' : ''}
            <b>${authorWithBadge}</b>: <span style="color:#333;">${c.text}</span> 
            <div style="margin-top:6px; display:flex; gap:12px; align-items:center;">
                
                <span onclick="reactComment('${postId}', '${c.id}', 'likes')" 
                      style="cursor:pointer; font-size:11px; color:${(c.likedBy || []).includes(uid) ? '#007bff' : 'gray'}; font-weight:bold;">
                    👍 ${c.likes || 0}
                </span>

                <span onclick="reactComment('${postId}', '${c.id}', 'hahas')" 
                      style="cursor:pointer; font-size:11px; color:${(c.hahaedBy || []).includes(uid) ? '#f7b928' : 'gray'}; font-weight:bold;">
                    😆 ${c.hahas || 0}
                </span>

                ${isAdmin ? `
                <span onclick="deleteComment('${postId}', '${c.id}')" 
                      style="color:red; cursor:pointer; margin-left:auto; font-size:11px; font-weight:bold;">
                    ဖျက်ရန်
                </span>` : ''}
            </div>
        </div>`;
    };

    // ၃။ ပထမ ၅ ခုကို Render လုပ်ခြင်း
    let html = displayedComments.map(c => createCommentHTML(c)).join('');

    // ၄။ "See More" နှင့် ကျန်ရှိသော Comments များ Logic
    if (hasMore) {
        html += `
        <div id="more-btn-${postId}" onclick="showAllComments('${postId}')" 
             style="color:purple; font-size:12px; cursor:pointer; font-weight:bold; margin: 8px 0; padding:5px; text-align:center;">
            💬 နောက်ထပ်မှတ်ချက် ${extraComments.length} ခုကို ဖတ်ရန်...
        </div>
        <div id="extra-comms-${postId}" style="display:none;">
            ${extraComments.map(c => createCommentHTML(c)).join('')}
        </div>`;
    }

    return html;
}

async function reactComment(postId, commentId, type) {
    // ၁။ Auth Check
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ Senior");
    const uid = auth.currentUser.uid;
    const ref = db.collection("health_posts").doc(postId);

    try {
        const snap = await ref.get();
        if (!snap.exists) return;

        let comments = snap.data().comments || [];
        
        // ၂။ ID စနစ်ဖြင့် Comment ကို ရှာဖွေခြင်း (Index Error ကာကွယ်ရန်)
        const commentIndex = comments.findIndex(c => c.id === commentId);
        if (commentIndex === -1) return console.log("Comment not found");

        let c = comments[commentIndex];
        const f = type === 'likes' ? 'likedBy' : 'hahaedBy';
        const cf = type === 'likes' ? 'likes' : 'hahas';

        // Array မရှိသေးရင် အသစ်ဆောက်ပေးခြင်း
        if (!c[f]) c[f] = [];
        
        let isAddingReaction = false;

        // ၃။ Toggle Logic (Reaction ပေး/ဖြုတ်)
        if (c[f].includes(uid)) {
            // Reaction ပြန်ဖြုတ်ခြင်း
            c[f] = c[f].filter(x => x !== uid);
            c[cf] = Math.max(0, (c[cf] || 0) - 1);
        } else {
            // Reaction အသစ်ပေးခြင်း
            c[f].push(uid);
            c[cf] = (c[cf] || 0) + 1;
            isAddingReaction = true; 
        }

        // ၄။ Database သို့ Update ပို့ခြင်း
        comments[commentIndex] = c;
        await ref.update({ comments });

        // ၅။ Notification ပို့ခြင်း (ကိုယ့် comment ကိုယ်ပြန်ပေးရင် မပို့ပါ)
        if (isAddingReaction && c.uid !== uid) {
            const reactionName = type === 'likes' ? "Like 👍" : "Haha 😂";
            
            await db.collection("notifications").add({
                receiverId: c.uid, // Comment ပိုင်ရှင်
                senderId: uid,
                title: "Reaction အသစ်ရှိပါသည်",
                body: `${auth.currentUser.displayName || "တစ်ယောက်"} က သင်၏ Comment ကို ${reactionName} ပေးလိုက်ပါတယ်`,
                status: "unread",
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("🔔 Notification Sent to Comment Owner");
        }

        console.log(`✅ ${type} toggled for comment: ${commentId}`);

    } catch (e) {
        console.error("Reaction Error:", e);
    }
}
// လက်ရှိ logic ကို အောက်ပါအတိုင်း အစားထိုးပါ
async function deleteComment(postId, commentId) {
    if(!confirm("ဤမှတ်ချက်ကို ဖျက်မလား Senior?")) return;
    const ref = db.collection("health_posts").doc(postId);
    
    try {
        const snap = await ref.get();
        let comments = snap.data().comments || [];
        
        // ID နဲ့ ရှာပြီး ဖျက်ထုတ်မယ်
        const updatedComments = comments.filter(c => c.id !== commentId);
        
        await ref.update({ comments: updatedComments });
        console.log("✅ Comment deleted via ID");
    } catch (e) {
        alert("Error: " + e.message);
    }
}

async function togglePin(id, current) { await db.collection("health_posts").doc(id).update({ isPinned: !current }); }
async function incrementView(id) { db.collection("health_posts").doc(id).update({ views: firebase.firestore.FieldValue.increment(1) }); }
async function handleShare(id) {
    // ၁။ User Login စစ်ဆေးခြင်း
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ Senior");
    
    try {
        const ref = db.collection("health_posts").doc(id);
        const snap = await ref.get();
        
        if (!snap.exists) return alert("မူရင်း Post ကို ရှာမတွေ့တော့ပါ Senior");
        
        const d = snap.data();

        // ၂။ မူရင်း Post ရဲ့ Share Count ကို Firestore Increment သုံးပြီး +1 တိုးမယ်
        await ref.update({ 
            shares: firebase.firestore.FieldValue.increment(1) 
        });

        // ၃။ Post အသစ်တစ်ခုအနေနဲ့ Feed ထဲကို ကူးယူထည့်သွင်းမယ် (Deep Copy & Reset)
        const sharedPostData = {
            ...d, // မူရင်း Text နဲ့ Media တွေကို ယူမယ်
            author: `${auth.currentUser.displayName || "User"} (Shared)`, // Share သူအမည်
            uid: auth.currentUser.uid, // Share တဲ့သူရဲ့ UID ကို အသုံးပြုမယ်
            
            // Stats များကို Reset လုပ်ခြင်း (အသစ်ပြန်စရန်)
            likes: 0, 
            likedBy: [], 
            hahas: 0, 
            hahaedBy: [], 
            comments: [], 
            shares: 0,
            views: 0,
            
            // Security & Layout Logic Reset
            isPinned: false, // Shared post ကို pin မလုပ်စေရန်
            isShared: true,  // Shared post ဖြစ်ကြောင်း မှတ်သားရန် (Optional - Styling အတွက်)
            originalPostId: id, // မူရင်း post နဲ့ ပြန်ချိတ်ချင်ရင် သုံးနိုင်ရန်
            
            // အချိန်ကို Server Timestamp သစ် သတ်မှတ်ရန်
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection("health_posts").add(sharedPostData);

        alert("အောင်မြင်စွာ Share ပြီးပါပြီ Senior! Feed မှာ ပြန်ကြည့်နိုင်ပါတယ်။");

    } catch (e) {
        console.error("Share Error:", e);
        alert("Share လုပ်လို့မရပါဘူး Senior: " + e.message);
    }
}

// ၁။ Media Preview စနစ် (လုံခြုံရေးပါဝင်သော version)
function previewMedia(input) {
    const box = document.getElementById('mediaPreviewBox');
    const file = input.files[0];
    
    // Hacker က Extension အတုလုပ်တာကို စစ်ဆေးခြင်း
    const validTypes = ['image/jpeg', 'image/png', 'video/mp4'];
    
    if (file) {
        // ဖိုင်အမျိုးအစား မမှန်ရင် Preview မပြဘဲ ချက်ချင်းရပ်ပစ်မယ်
        if (!validTypes.includes(file.type)) {
            alert("Senior... ဓာတ်ပုံနဲ့ MP4 ဗီဒီယိုပဲ တင်လို့ရပါတယ်ဗျာ။");
            input.value = ""; // Input ကို ပြန်ရှင်းပစ်မယ်
            return;
        }
        
        box.style.display = 'block';
        const url = URL.createObjectURL(file);
        box.innerHTML = file.type.startsWith('video/') 
            ? `<video src="${url}" style="width:100%; border-radius:8px;" muted autoplay loop></video>`
            : `<img src="${url}" style="width:100%; border-radius:8px;">`;
    }
}

// --- Global Functions ---
function isSafeName(name) {
    if (!name) return false;
    const safePattern = /^[a-zA-Z0-9\u1000-\u109F\s]+$/;
    return safePattern.test(name);
}
// --- ၁။ နာမည်သိမ်းသည့် Function (ပေါင်းစည်းပြီးသား) ---
async function saveInitialName() {
    const nameElement = document.getElementById('setupUserName');
    if(!nameElement) return;

    const inputName = nameElement.value.trim();

    // စစ်ဆေးမှုများ (Validation Layers)
    if(inputName.length < 2) {
        return alert("အမည်အမှန်ရိုက်ပါ (အနည်းဆုံး ၂ လုံး)");
    }

    if (!isSafeName(inputName)) {
        return alert("Senior ရေ... နာမည်မှာ Emoji နဲ့ Special Character တွေ မသုံးပါနဲ့ဗျာ။ စာသားနဲ့ ဂဏန်းပဲ သုံးပေးပါ။");
    }

    try {
        // Firebase Auth Update
        await auth.currentUser.updateProfile({ 
            displayName: inputName 
        });

        // Firestore Database Update (Sync လုပ်ခြင်း)
        await db.collection("users").doc(auth.currentUser.uid).set({
            displayName: inputName,
            // နာမည်ပြင်ပြီးသားဖြစ်ကြောင်း Flag တစ်ခုပါ ထည့်ထားလို့ရတယ် Senior
            isProfileSetup: true 
        }, { merge: true });

        console.log("Success: Name updated to " + inputName);
        location.reload(); // ပြောင်းလဲမှုတွေ မြင်ရအောင် Reload လုပ်မယ်
        
    } catch (error) {
        console.error("Error saving name: ", error);
        alert("သိမ်းလို့မရဖြစ်နေပါတယ် Senior။ ခဏနေမှ ပြန်လုပ်ကြည့်ပါ။");
    }
}

// --- ၃။ Comment အကုန်ပြသည့် Function ---
function showAllComments(postId) {
    const extra = document.getElementById(`extra-comms-${postId}`);
    const btn = document.getElementById(`more-btn-${postId}`);
    if (extra && btn) {
        extra.style.display = 'block';
        btn.style.display = 'none';
    }
}

// Listener အပြင်ဘက်မှာ ပြုပြင်ပြီးသား Noti ID များကို သိမ်းရန် Set တစ်ခုဆောက်ပါ
const processedNotis = new Set();


/**
 * သတ်မှတ်ထားသော Post ဆီသို့ Scroll ဆွဲပေးပြီး Highlight ပြပေးသော Function
 */
function scrollToPost(postId) {
    const postElement = document.getElementById(`post-${postId}`);

    if (postElement) {
        // Post ရှိတဲ့နေရာကို ညင်သာစွာ Scroll ဆွဲမယ်
        postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Highlight ပြခြင်း (User သိသာအောင် ၃ စက္ကန့်ကြာ အဝါရောင်သန်းပေးမည်)
        postElement.style.transition = "background 0.5s ease";
        postElement.style.background = "#fff9c4"; 

        setTimeout(() => {
            postElement.style.background = "white"; 
        }, 3000);
    } else {
        console.log("Post not found on current screen. Loading might be needed.");
        // တကယ်လို့ Post က screen ပေါ်မရောက်သေးရင် loadPosts() ကို ပြန်စစ်ဖို့ လိုနိုင်ပါတယ်
    }
}


async function startAutoFriendSystem(myUid) {
    try {
        const myRef = db.collection("users").doc(myUid);
        const myDoc = await myRef.get();
        if (!myDoc.exists) return;
        const myData = myDoc.data();

        // ၁။ အရင်လုပ်ပြီးသားလား စစ်ဆေးခြင်း (Double Check)
        if (myData.isAutoFriendAdded === true) return;

        const limit = 50; 
        let currentCount = 0;

        // ၂။ အခြား User များကို ဆွဲထုတ်ခြင်း
        const usersSnap = await db.collection("users")
            .where("uid", "!=", myUid)
            .limit(limit) 
            .get();

        if (usersSnap.empty) return;

        const batch = db.batch();

        usersSnap.forEach(doc => {
            const otherUser = doc.data();
            
            // ကိုယ့် Friend list ထဲထည့် (Database Write 1)
            const myFriendRef = myRef.collection("friends").doc(otherUser.uid);
            batch.set(myFriendRef, {
                uid: otherUser.uid,
                displayName: otherUser.displayName || "User",
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // သူ့ Friend list ထဲ ကိုယ့်ကိုပြန်ထည့် (Database Write 2)
            const otherFriendRef = db.collection("users").doc(otherUser.uid).collection("friends").doc(myUid);
            batch.set(otherFriendRef, {
                uid: myUid,
                displayName: myData.displayName || "User",
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            currentCount++;
        });

        // ၃။ Flag ကို Update လုပ်ခြင်း
        batch.update(myRef, { 
            isAutoFriendAdded: true,
            friendCount: firebase.firestore.FieldValue.increment(currentCount)
        });

        // ၄။ Database သို့ Batch Commit လုပ်ခြင်း 
        await batch.commit();
if (Notification.permission === "granted") {
    const notification = new Notification("System Success ✅", {
        body: `သူငယ်ချင်းသစ် ${currentCount} ယောက်ကို အလိုအလျောက် ချိတ်ဆက်ပေးလိုက်ပါပြီ။`,
        icon: "https://yourdomain.com/logo.png", // တိုက်ရိုက် Link ပေးရင် ပိုစိတ်ချရပါတယ်
        badge: "https://yourdomain.com/badge-icon.png", // ဖုန်း Noti bar မှာပေါ်မယ့် icon သေးသေးလေး
        vibrate: [200, 100, 200] // ဖုန်းဆိုရင် တုန်ခါမှုပေးတာမျိုး (Android သာရသည်)
    });

    // Notification ကို နှိပ်လိုက်ရင် App ဆီ ပြန်ရောက်သွားအောင် လုပ်ချင်ရင်
    notification.onclick = function() {
        window.focus();
        this.close();
    };
}



        console.log(`✅ Success: Added ${currentCount} friends without DB Notification costs.`);

    } catch (e) {
        console.error("AutoFriend Cost-Saving Error:", e);
    }
}

async function checkBanStatus(userId, deviceId) {
    // ၁။ Device ID နဲ့ စစ်မယ်
    const deviceSnap = await db.collection("banned_devices").doc(deviceId).get();
    
    // ၂။ User UID နဲ့ စစ်မယ်
    const userSnap = await db.collection("users").doc(userId).get();
    const userData = userSnap.data();

    if (deviceSnap.exists || (userData && userData.isBanned)) {
        alert("သင့် Device သည် စည်းကမ်းဖောက်ဖျက်မှုကြောင့် အပြီးတိုင် ပိတ်ပင် (Ban) ခံထားရပါသည်။");
        auth.signOut();
        window.location.href = "banned_info.html"; // Ban ခံရကြောင်း ပြမယ့်စာမျက်နှာ
    }
}
// --- Feedback တင်ပေးမည့် Function ---
async function submitFeedback() {
    const msg = document.getElementById('feedbackMsg').value.trim();
    if (!msg) return alert("စာသားလေး တစ်ခုခု ရေးပေးပါဦး Senior");

    try {
        const user = auth.currentUser;
        // Device အချက်အလက်ယူခြင်း (Admin သိအောင်)
        const deviceInfo = navigator.userAgent.split(')')[0].split('(')[1] || "Unknown Device";

        await db.collection("feedbacks").add({
            uid: user.uid,
            userName: user.displayName || "အမည်မသိ",
            feedbackMsg: msg,
            device: deviceInfo,
            version: "1.0.0", // Senior ရဲ့ App Version
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("ကျေးဇူးတင်ပါတယ် Senior! Feedback ကို Admin Panel ဆီ ပို့လိုက်ပါပြီ။");
        document.getElementById('feedbackMsg').value = ""; // စာသားပြန်ဖျက်မယ်
    } catch (e) {
        alert("Error: " + e.message);
    }
}
// ပေါင်းစပ်ထားသော Logic: Security + Media Upload + No-Reload UI Reset
async function handlePost(collection = "health_posts", parentId = null) {
    // ၁။ UI Elements များကို ဖမ်းယူခြင်း
    const textEl = document.getElementById('postText');
    const mediaInput = document.getElementById('mediaInput');
    const imageArea = document.getElementById("mediaPreview") || document.getElementById("imagePreview"); 
    const btn = document.getElementById('btnPost');

    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ Senior");

    // ၂။ User Status & Premium Limits သတ်မှတ်ခြင်း
    const isPremium = window.currentUserData?.isCrown || window.currentUserData?.isGold || false;
    const text = textEl.value.trim();
    
    // Global media array သို့မဟုတ် Input မှ Files ကို ယူခြင်း
    const files = (typeof selectedMediaFiles !== 'undefined' && selectedMediaFiles.length > 0) 
                  ? selectedMediaFiles 
                  : Array.from(mediaInput.files);

    // ၃။ Validation (Premium vs Free)
    const maxFiles = isPremium ? 10 : 1;
    const maxSizeMB = isPremium ? 60 : 20; // Premium ဆို 60MB, Free ဆို 20MB
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (!text && files.length === 0) return alert("စာသား သို့မဟုတ် မီဒီယာ တစ်ခုခု ထည့်ပေးပါ Senior");
    
    if (files.length > maxFiles) {
        return alert(`Senior ရေ... Premium မဟုတ်လို့ ပုံ ${maxFiles} ပုံပဲ တင်ခွင့်ရှိပါတယ်ဗျာ။`);
    }

    // ၄။ UI Loading State ပြောင်းလဲခြင်း
    btn.disabled = true;
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = "လုံခြုံစွာ တင်ပေးနေပါသည်...";

    try {
        // ၅။ Media Upload Processing (ImgBB & Bunny CDN)
        const uploadPromises = files.map(async file => {
            // File Size & Type Security Check
            if (file.size > maxSizeBytes) throw new Error(`${file.name} က ${maxSizeMB}MB ထက် ကြီးနေပါတယ်`);
            
            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];
            if (!allowedTypes.includes(file.type)) throw new Error("JPG, PNG, WebP သို့မဟုတ် MP4 သာ ရပါသည်");

            if (file.type.startsWith('video/')) {
                // Bunny CDN Upload Logic
                const fName = `vid_${Date.now()}_${auth.currentUser.uid.substring(0,5)}.mp4`;
                const res = await fetch(`https://sg.storage.bunnycdn.com/${BUNNY_STORAGE}/${fName}`, {
                    method: 'PUT', 
                    headers: { 'AccessKey': BUNNY_KEY }, 
                    body: file
                });
                if(!res.ok) throw new Error("Bunny Storage သို့ Video တင်လို့ မရပါ");
                return { url: `https://public-hospitals.b-cdn.net/${fName}`, type: 'video' };
            } else {
                // ImgBB Upload Logic
                const fd = new FormData(); 
                fd.append('image', file);
                const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: fd });
                const d = await res.json();
                if(!d.success) throw new Error("ImgBB သို့ ပုံတင်လို့ မရပါ");
                return { url: d.data.url, type: 'image' };
            }
        });

        const mediaResults = await Promise.all(uploadPromises);
        
        // ၆။ Database Entry (Full Integrated Data Structure)
        const newPostData = {
            uid: auth.currentUser.uid,
            parentId: parentId, // Page/Group ID သို့မဟုတ် Null
            author: window.currentUserData?.displayName || auth.currentUser.displayName || "User",
            text: text,
            media: mediaResults,
            // Premium Status Logic
            isCrown: window.currentUserData?.isCrown || false,
            isGold: window.currentUserData?.isGold || false,
            isPremiumPost: isPremium,
            // Stats & States
            likes: 0, likedBy: [], 
            hahas: 0, hahaedBy: [],
            comments: [],
            shares: 0,
            views: 0,
            isPinned: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp() 
        };

        const postRef = await db.collection(collection).add(newPostData);

        // ၇။ ✨ Premium Notification Logic (Post တင်ပြီးမှ ပို့မည်)
        if (isPremium) {
            sendPremiumPostNotifications(auth.currentUser.uid, newPostData.author, postRef.id, text);
        }

        // ၈။ Professional UI Reset (No Reload Required)
        textEl.value = ""; 
        if (mediaInput) mediaInput.value = "";
        if (imageArea) imageArea.innerHTML = "";
        if (typeof selectedMediaFiles !== 'undefined') selectedMediaFiles = []; 
        if (typeof closeModal === "function") closeModal(); 

        alert("အောင်မြင်စွာ တင်ပြီးပါပြီ Senior!");

    } catch (e) { 
        console.error("Post Upload Error:", e);
        alert("Error: " + e.message); 
    } finally {
        // ၉။ Restore Button State
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
    }
}

// --- Premium Noti Helper Function ---
async function sendPremiumPostNotifications(senderId, senderName, postId, postText) {
    try {
        const followersSnap = await db.collection("users").doc(senderId).collection("followers").get();
        if (followersSnap.empty) return;

        const batch = db.batch();
        followersSnap.forEach(doc => {
            const notiRef = db.collection("notifications").doc();
            batch.set(notiRef, {
                receiverId: doc.id,
                senderId: senderId,
                senderName: senderName,
                title: `🌟 Premium Post: ${senderName}`,
                body: postText.substring(0, 50) + (postText.length > 50 ? "..." : ""),
                postId: postId,
                status: "unread",
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
    } catch (e) { console.error("Noti Error:", e); }
}

async function deletePost(collection, id) {
    // ၁။ User Confirmation (Safety First)
    if (!confirm("ဒီ Post နဲ့တကွ မှတ်ချက် (Comments) အားလုံးကို အပြီးတိုင်ဖျက်မှာ သေချာလား Senior?")) return;

    try {
        const ref = db.collection(collection).doc(id);
        const snap = await ref.get();
        
        if (!snap.exists) {
            console.error("Post not found!");
            return;
        }
        
        const data = snap.data();

              const mediaItems = data.media || (data.mediaUrl ? [{url: data.mediaUrl, type: data.mediaType || 'image'}] : []);

        for (let m of mediaItems) {
            // Bunny CDN Link ဖြစ်မှသာ ဖျက်မည်
            if (m.url && m.url.includes('b-cdn.net')) {
                try {
                    const fName = m.url.split('/').pop();
                    await fetch(`https://sg.storage.bunnycdn.com/${BUNNY_STORAGE}/${fName}`, {
                        method: 'DELETE',
                        headers: { 'AccessKey': BUNNY_KEY }
                    });
                    console.log(`✅ Media deleted from Storage: ${fName}`);
                } catch (err) { 
                    // Media ဖျက်လို့မရရင်တောင် Database ဖျက်တာကို ဆက်လုပ်စေရန်
                    console.warn("Media cleanup failed, skipping...", err); 
                }
            }
        }

        // ၃။ Firestore Batch Deletion (Performance ပိုမြန်စေရန်)
        const batch = db.batch();

        // (က) Sub-collections များကို အမြစ်ပြတ်ရှင်းထုတ်ခြင်း
        const subCollections = ["comments", "reactions"]; 
        for (const subName of subCollections) {
            const subSnap = await ref.collection(subName).get();
            subSnap.forEach(doc => {
                batch.delete(doc.ref);
            });
        }

        // (ခ) Parent Post ကိုပါ Batch ထဲထည့်ခြင်း
        batch.delete(ref);

        // (ဂ) အကုန်လုံးကို တစ်ခါတည်း Commit လုပ်မည်
        await batch.commit();
        
        console.log("✅ Post, Media, and Sub-collections cleared successfully.");
        alert("အောင်မြင်စွာ ဖျက်သိမ်းပြီးပါပြီ Senior");

    } catch (e) {
        console.error("❌ Deep Delete Error:", e);
        alert("ဖျက်လို့မရဖြစ်နေပါတယ် Senior: " + e.message);
    }
}

// --- Search Logic (Suresh Box Style) ---
async function searchPage(coll, field) {
    const q = document.getElementById('pageSearch').value.toLowerCase();
    const resBox = document.getElementById('searchResults');
    if (!q) { resBox.style.display = 'none'; return; }

    const snap = await db.collection(coll).get();
    resBox.innerHTML = "";
    snap.forEach(doc => {
        const name = doc.data()[field] || "";
        if (name.toLowerCase().includes(q)) {
            resBox.style.display = 'block';
            const div = document.createElement('div');
            div.className = "search-item";
            div.innerHTML = name;
            div.onclick = () => window.location.href = `?id=${doc.id}`;
            resBox.appendChild(div);
        }
    });
}
async function banUser(userId, userName) {
    if (!isAdmin) return; 
    
    const reason = prompt(`${userName} ကို ဘာကြောင့် Ban တာလဲ Senior? (အကြောင်းပြချက်ရေးပါ)`);
    if (reason === null) return;

    try {
        const userDoc = await db.collection("users").doc(userId).get();
        const userData = userDoc.data();
        const deviceId = userData ? userData.deviceId : null;

        const batch = db.batch();

        // ၁။ User ကို Ban status ပြောင်းမယ်
        batch.update(db.collection("users").doc(userId), { 
            isBanned: true, 
            banReason: reason,
            bannedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // ၂။ Device ID ကိုပါ Blacklist ထည့်မယ်
        if (deviceId) {
            batch.set(db.collection("banned_devices").doc(deviceId), {
                bannedUid: userId,
                reason: reason,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        await batch.commit();
        alert(`အောင်မြင်ပါသည်! ${userName} ကို ပိတ်ပင်လိုက်ပါပြီ။`);
    } catch (e) {
        alert("Ban လုပ်လို့မရပါ: " + e.message);
    }
}

