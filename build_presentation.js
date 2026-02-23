const pptxgen = require("pptxgenjs");
const path = require("path");

const pptx = new pptxgen();
const filePath = path.join(__dirname, "Skill_Based_Quiz_Platform_Presentation.pptx");

// Title Slide
let slide = pptx.addSlide();
slide.addText("Skill-Based Learning Quiz Platform", { x: 1, y: 1.5, w: 8, h: 1, fontSize: 36, color: "0088CC", bold: true, align: "center" });
slide.addText("Learn Fast • Compete Fair • Win Real Rewards", { x: 1, y: 3, w: 8, h: 1, fontSize: 24, align: "center" });

// Slides data
const slides = [
    ["Platform Vision", "• Education + Skill Improvement\n• Speed & Accuracy Based\n• Transparent System\n• Real Rewards\n• Not Gambling"],
    ["User Entry System", "• Mobile OTP Login\n• 1 Mobile = 1 Account\n• 1 UPI = 1 Account\n• Fake Users Blocked"],
    ["Category & Session Structure", "• Beginner, Skill Builder, Pro Speed\n• Only 1 Active Session per Category\n• Seats: 20 / 50 / 70 / 100"],
    ["Core Rule", "Session will NOT start until full booking.\nIf even 1 seat is empty:\nQuiz ❌ PDF ❌ Timer ❌"],
    ["Question Transparency", "• Questions visible to everyone\n• Answers after payment\n• Builds trust before payment"],
    ["Payment System", "• User pays via own UPI\n• Payment confirms seat\n• Session-based fees"],
    ["Platform Revenue Model", "100 users × ₹100 = ₹10,000\n25% → Owner UPI\n75% → Prize Pool"],
    ["Full Booking Confirmation", "• Auto session confirmation\n• Popup on Mobile & PC\n• Quiz & PDF time shown"],
    ["Session Time Flow", "1 Hour Total\n30 min Pre-Study\n30 min Live Quiz"],
    ["Pre-Study Phase", "• PDF 30 min before quiz\n• Paid users only\n• Q + Answer + Explanation\n• Watermark applied"],
    ["Live Quiz Phase", "• Same 20 questions\n• Random order\n• Timer enabled"],
    ["Winner Decision Logic", "1. Highest correct answers\n2. Fastest time\nSkill-based only"],
    ["Prize Distribution", "• Top performers rewarded\n• Direct UPI / Bank transfer\n• No delay"],
    ["Refund Policy", "No refund if user misses.\nRefund only if system cancels."],
    ["Security & Fair Play", "• One user = One account\n• One UPI = One account\n• Bot detection\n• Copy blocked"],
    ["Final Summary", "Full booking → Notification → Study → Quiz → Skill-based winners → Money direct to account"]
];

slides.forEach(s => {
    let slide = pptx.addSlide();
    slide.addText(s[0], { x: 0.5, y: 0.5, w: 9, h: 1, fontSize: 32, color: "0088CC", bold: true });
    slide.addText(s[1], { x: 0.5, y: 1.5, w: 9, h: 4, fontSize: 20 });
});

pptx.writeFile({ fileName: filePath }).then(f => {
    console.log(`✅ Presentation ready: ${filePath}`);
}).catch(e => {
    console.error("❌ Error:", e.message);
});
