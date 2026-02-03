// Comment ဖျက်သည့် Function
async function deleteComment(pId, cId) {
    if (!confirm("ဒီမှတ်ချက်ကို ဖျက်မှာ သေချာပါသလား?")) return;

    try {
        const ref = db.collection("health_posts").doc(pId);
        const doc = await ref.get();
        
        if (doc.exists) {
            const allComments = doc.data().comments || [];
            // ID မတူတဲ့ comment တွေကိုပဲ ချန်လှပ်ပြီး စာရင်းအသစ် ပြန်လုပ်ခြင်း
            const updatedComments = allComments.filter(c => c.id !== cId);
            
            await ref.update({
                comments: updatedComments
            });
            // အောင်မြင်ရင် alert ပြစရာမလိုဘဲ UI က အလိုလို update ဖြစ်သွားပါလိမ့်မယ်
        }
    } catch (e) {
        console.error("Error deleting comment: ", e);
        alert("ဖျက်လို့မရပါ- " + e.message);
    }
}
