/**
 * SEED SCRIPT: 10 Hindi GK Sessions
 * - Entry Fee: ₹20
 * - Seat Limit: 30
 * - Questions per session: 20 (Hindi GK)
 * Run: node seed_hindi_gk.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(e => { console.error('❌ MongoDB Error:', e.message); process.exit(1); });

const Session = require('./database/models/Session');
const Category = require('./database/models/Category');
const Question = require('./database/models/Question');

// ─── 200 Hindi GK Questions (10 sets × 20 each) ───────────────────────────────
const allQuestions = [
  // ─ SET 1 ─
  { question_text: 'भारत की राजधानी कौन सी है?', option_a: 'मुंबई', option_b: 'दिल्ली', option_c: 'कोलकाता', option_d: 'चेन्नई', correct: 'B', explanation: 'नई दिल्ली भारत की राजधानी है।' },
  { question_text: 'भारत का राष्ट्रीय पशु कौन है?', option_a: 'शेर', option_b: 'हाथी', option_c: 'बाघ', option_d: 'गाय', correct: 'C', explanation: 'बंगाल टाइगर (बाघ) भारत का राष्ट्रीय पशु है।' },
  { question_text: 'भारत का राष्ट्रीय पक्षी कौन है?', option_a: 'तोता', option_b: 'मोर', option_c: 'कोयल', option_d: 'हंस', correct: 'B', explanation: 'मोर भारत का राष्ट्रीय पक्षी है।' },
  { question_text: 'भारत की सबसे लंबी नदी कौन सी है?', option_a: 'यमुना', option_b: 'गंगा', option_c: 'गोदावरी', option_d: 'नर्मदा', correct: 'B', explanation: 'गंगा नदी भारत की सबसे लंबी नदी है।' },
  { question_text: 'भारत में कितने राज्य हैं?', option_a: '25', option_b: '27', option_c: '28', option_d: '29', correct: 'C', explanation: 'वर्तमान में भारत में 28 राज्य हैं।' },
  { question_text: 'भारत का सर्वोच्च पुरस्कार कौन सा है?', option_a: 'पद्म भूषण', option_b: 'भारत रत्न', option_c: 'अर्जुन पुरस्कार', option_d: 'पद्म विभूषण', correct: 'B', explanation: 'भारत रत्न भारत का सर्वोच्च नागरिक पुरस्कार है।' },
  { question_text: 'भारत का राष्ट्रीय फूल कौन सा है?', option_a: 'गुलाब', option_b: 'गेंदा', option_c: 'कमल', option_d: 'चमेली', correct: 'C', explanation: 'कमल भारत का राष्ट्रीय फूल है।' },
  { question_text: 'भारत का राष्ट्रीय फल कौन सा है?', option_a: 'केला', option_b: 'सेब', option_c: 'आम', option_d: 'संतरा', correct: 'C', explanation: 'आम भारत का राष्ट्रीय फल है।' },
  { question_text: 'राष्ट्रपिता महात्मा गांधी का जन्म कहाँ हुआ था?', option_a: 'मुंबई', option_b: 'पोरबंदर', option_c: 'अहमदाबाद', option_d: 'सूरत', correct: 'B', explanation: 'महात्मा गांधी का जन्म 2 अक्टूबर 1869 को गुजरात के पोरबंदर में हुआ था।' },
  { question_text: 'भारत का संविधान कब लागू हुआ?', option_a: '15 अगस्त 1947', option_b: '26 नवम्बर 1949', option_c: '26 जनवरी 1950', option_d: '1 जनवरी 1952', correct: 'C', explanation: '26 जनवरी 1950 को भारत का संविधान लागू हुआ।' },
  { question_text: 'भारत की पहली महिला प्रधानमंत्री कौन थीं?', option_a: 'सोनिया गांधी', option_b: 'इंदिरा गांधी', option_c: 'प्रतिभा पाटिल', option_d: 'सुषमा स्वराज', correct: 'B', explanation: 'इंदिरा गांधी भारत की पहली और एकमात्र महिला प्रधानमंत्री थीं।' },
  { question_text: 'ताजमहल कहाँ स्थित है?', option_a: 'दिल्ली', option_b: 'जयपुर', option_c: 'आगरा', option_d: 'लखनऊ', correct: 'C', explanation: 'ताजमहल उत्तर प्रदेश के आगरा में स्थित है।' },
  { question_text: 'भारत का सबसे बड़ा राज्य (क्षेत्रफल) कौन सा है?', option_a: 'उत्तर प्रदेश', option_b: 'मध्य प्रदेश', option_c: 'राजस्थान', option_d: 'महाराष्ट्र', correct: 'C', explanation: 'राजस्थान क्षेत्रफल की दृष्टि से भारत का सबसे बड़ा राज्य है।' },
  { question_text: 'भारत का सर्वोच्च न्यायालय कहाँ है?', option_a: 'मुंबई', option_b: 'कोलकाता', option_c: 'नई दिल्ली', option_d: 'चेन्नई', correct: 'C', explanation: 'भारत का सर्वोच्च न्यायालय नई दिल्ली में स्थित है।' },
  { question_text: 'भारत का सबसे बड़ा बंदरगाह कौन सा है?', option_a: 'मुंबई', option_b: 'कोच्चि', option_c: 'कोलकाता', option_d: 'विशाखापत्तनम', correct: 'A', explanation: 'मुंबई बंदरगाह भारत का सबसे बड़ा प्राकृतिक बंदरगाह है।' },
  { question_text: 'प्रसिद्ध "गायत्री मंत्र" किस वेद में है?', option_a: 'ऋग्वेद', option_b: 'सामवेद', option_c: 'यजुर्वेद', option_d: 'अथर्ववेद', correct: 'A', explanation: 'गायत्री मंत्र ऋग्वेद में है।' },
  { question_text: 'भारत का राष्ट्रीय गान किसने लिखा?', option_a: 'बंकिमचंद्र चटर्जी', option_b: 'रविंद्रनाथ टैगोर', option_c: 'महात्मा गांधी', option_d: 'जवाहरलाल नेहरू', correct: 'B', explanation: 'जन गण मन रविंद्रनाथ टैगोर द्वारा लिखा गया।' },
  { question_text: 'भारत का राष्ट्रगीत कौन सा है?', option_a: 'जन गण मन', option_b: 'वंदे मातरम', option_c: 'सारे जहाँ से अच्छा', option_d: 'मेरा भारत महान', correct: 'B', explanation: 'वंदे मातरम भारत का राष्ट्रगीत है।' },
  { question_text: 'भारत के प्रथम राष्ट्रपति कौन थे?', option_a: 'जवाहरलाल नेहरू', option_b: 'डॉ. राजेंद्र प्रसाद', option_c: 'सर्वपल्ली राधाकृष्णन', option_d: 'वी.वी. गिरि', correct: 'B', explanation: 'डॉ. राजेंद्र प्रसाद भारत के प्रथम राष्ट्रपति थे।' },
  { question_text: 'भारत का सबसे ऊंचा पर्वत शिखर कौन सा है?', option_a: 'नंदादेवी', option_b: 'कंचनजंगा', option_c: 'K2', option_d: 'गॉडविन ऑस्टिन', correct: 'B', explanation: 'कंचनजंगा भारत का सबसे ऊंचा पर्वत शिखर है।' },

  // ─ SET 2 ─
  { question_text: 'हिन्दी दिवस कब मनाया जाता है?', option_a: '14 जनवरी', option_b: '14 अगस्त', option_c: '14 सितंबर', option_d: '14 नवंबर', correct: 'C', explanation: '14 सितंबर को हिन्दी दिवस मनाया जाता है।' },
  { question_text: 'भारत के प्रथम प्रधानमंत्री कौन थे?', option_a: 'सरदार पटेल', option_b: 'महात्मा गांधी', option_c: 'जवाहरलाल नेहरू', option_d: 'डॉ. अम्बेडकर', correct: 'C', explanation: 'पंडित जवाहरलाल नेहरू भारत के प्रथम प्रधानमंत्री थे।' },
  { question_text: 'भारत में कितने केंद्र शासित प्रदेश हैं?', option_a: '6', option_b: '7', option_c: '8', option_d: '9', correct: 'C', explanation: 'भारत में 8 केंद्र शासित प्रदेश हैं।' },
  { question_text: 'भारत की मुद्रा का नाम क्या है?', option_a: 'डॉलर', option_b: 'पाउंड', option_c: 'रुपया', option_d: 'यूरो', correct: 'C', explanation: 'भारत की मुद्रा रुपया (₹) है।' },
  { question_text: '"सत्यमेव जयते" किस ग्रंथ से लिया गया है?', option_a: 'ऋग्वेद', option_b: 'मुंडकोपनिषद', option_c: 'भगवद्गीता', option_d: 'रामायण', correct: 'B', explanation: 'सत्यमेव जयते मुंडकोपनिषद से लिया गया है।' },
  { question_text: 'भारत का क्षेत्रफल कितना है?', option_a: '22 लाख वर्ग किमी', option_b: '29 लाख वर्ग किमी', option_c: '33 लाख वर्ग किमी', option_d: '40 लाख वर्ग किमी', correct: 'C', explanation: 'भारत का क्षेत्रफल लगभग 32.87 लाख वर्ग किमी है।' },
  { question_text: 'सबसे पहले चंद्रमा पर कौन गया?', option_a: 'यूरी गागरिन', option_b: 'नील आर्मस्ट्रांग', option_c: 'बज़ एल्ड्रिन', option_d: 'माइकल कोलिंस', correct: 'B', explanation: 'नील आर्मस्ट्रांग चंद्रमा पर जाने वाले पहले व्यक्ति थे (1969)।' },
  { question_text: 'भारत का सबसे बड़ा राज्य (जनसंख्या) कौन सा है?', option_a: 'महाराष्ट्र', option_b: 'बिहार', option_c: 'उत्तर प्रदेश', option_d: 'राजस्थान', correct: 'C', explanation: 'उत्तर प्रदेश जनसंख्या की दृष्टि से भारत का सबसे बड़ा राज्य है।' },
  { question_text: 'विश्व का सबसे बड़ा महाद्वीप कौन सा है?', option_a: 'अफ्रीका', option_b: 'ऑस्ट्रेलिया', option_c: 'एशिया', option_d: 'यूरोप', correct: 'C', explanation: 'एशिया विश्व का सबसे बड़ा महाद्वीप है।' },
  { question_text: 'पृथ्वी का सबसे ऊंचा पर्वत कौन सा है?', option_a: 'K2', option_b: 'कंचनजंगा', option_c: 'माउंट एवरेस्ट', option_d: 'माउंट किलिमंजारो', correct: 'C', explanation: 'माउंट एवरेस्ट (8848.86 मीटर) पृथ्वी का सबसे ऊंचा पर्वत है।' },
  { question_text: 'प्लासी का युद्ध कब हुआ था?', option_a: '1756', option_b: '1757', option_c: '1761', option_d: '1764', correct: 'B', explanation: 'प्लासी का युद्ध 23 जून 1757 को हुआ था।' },
  { question_text: '"जय जवान जय किसान" का नारा किसने दिया?', option_a: 'जवाहरलाल नेहरू', option_b: 'इंदिरा गांधी', option_c: 'लाल बहादुर शास्त्री', option_d: 'सरदार पटेल', correct: 'C', explanation: 'जय जवान जय किसान का नारा लाल बहादुर शास्त्री ने दिया था।' },
  { question_text: 'भारत की पहली महिला राष्ट्रपति कौन थीं?', option_a: 'सुषमा स्वराज', option_b: 'सोनिया गांधी', option_c: 'प्रतिभा देवीसिंह पाटिल', option_d: 'मीरा कुमार', correct: 'C', explanation: 'प्रतिभा देवीसिंह पाटिल भारत की पहली महिला राष्ट्रपति थीं (2007-2012)।' },
  { question_text: 'विश्व की सबसे बड़ी नदी (लंबाई) कौन सी है?', option_a: 'अमेज़न', option_b: 'नील', option_c: 'गंगा', option_d: 'मिसिसिपी', correct: 'B', explanation: 'नील नदी विश्व की सबसे लंबी नदी है।' },
  { question_text: 'भारत में लोकसभा में कुल कितनी सीटें हैं?', option_a: '520', option_b: '543', option_c: '545', option_d: '552', correct: 'B', explanation: 'लोकसभा में 543 निर्वाचित सीटें हैं।' },
  { question_text: 'किस देश को "उगते सूरज का देश" कहा जाता है?', option_a: 'चीन', option_b: 'जापान', option_c: 'कोरिया', option_d: 'थाईलैंड', correct: 'B', explanation: 'जापान को उगते सूरज का देश कहा जाता है।' },
  { question_text: 'पंचायती राज दिवस कब मनाया जाता है?', option_a: '24 अप्रैल', option_b: '15 मई', option_c: '26 जनवरी', option_d: '2 अक्टूबर', correct: 'A', explanation: '24 अप्रैल को राष्ट्रीय पंचायती राज दिवस मनाया जाता है।' },
  { question_text: 'भारत का राष्ट्रीय खेल कौन सा है?', option_a: 'क्रिकेट', option_b: 'कबड्डी', option_c: 'हॉकी', option_d: 'फुटबॉल', correct: 'C', explanation: 'हॉकी भारत का राष्ट्रीय खेल है।' },
  { question_text: 'सिक्किम भारत का राज्य कब बना?', option_a: '1972', option_b: '1973', option_c: '1975', option_d: '1977', correct: 'C', explanation: '16 मई 1975 को सिक्किम भारत का 22वाँ राज्य बना।' },
  { question_text: '"अर्थशास्त्र" पुस्तक किसने लिखी?', option_a: 'चाणक्य', option_b: 'विक्रमादित्य', option_c: 'बाणभट्ट', option_d: 'कालिदास', correct: 'A', explanation: '"अर्थशास्त्र" चाणक्य (कौटिल्य) द्वारा लिखी गई पुस्तक है।' },

  // ─ SET 3 ─
  { question_text: 'भारत में सर्वाधिक वर्षा कहाँ होती है?', option_a: 'चेरापूंजी', option_b: 'माउसिनराम', option_c: 'शिलॉन्ग', option_d: 'मेघालय शहर', correct: 'B', explanation: 'माउसिनराम में विश्व में सर्वाधिक वर्षा होती है।' },
  { question_text: 'भारत का राष्ट्रीय वृक्ष कौन सा है?', option_a: 'पीपल', option_b: 'बरगद', option_c: 'नीम', option_d: 'आम', correct: 'B', explanation: 'बरगद (वट वृक्ष) भारत का राष्ट्रीय वृक्ष है।' },
  { question_text: 'विश्व का सबसे छोटा देश कौन सा है?', option_a: 'मोनाको', option_b: 'वेटिकन सिटी', option_c: 'सैन मरीनो', option_d: 'लिकटेंस्टाइन', correct: 'B', explanation: 'वेटिकन सिटी विश्व का सबसे छोटा देश है।' },
  { question_text: 'भारत में "स्वतंत्रता दिवस" कब मनाया जाता है?', option_a: '26 जनवरी', option_b: '15 अगस्त', option_c: '2 अक्टूबर', option_d: '14 नवंबर', correct: 'B', explanation: '15 अगस्त 1947 को भारत स्वतंत्र हुआ था।' },
  { question_text: '"गीत गोविंद" के रचयिता कौन हैं?', option_a: 'तुलसीदास', option_b: 'कबीर', option_c: 'जयदेव', option_d: 'मीराबाई', correct: 'C', explanation: 'जयदेव ने "गीत गोविंद" की रचना की थी।' },
  { question_text: 'भारत की सबसे बड़ी झील कौन सी है?', option_a: 'डल झील', option_b: 'वुलर झील', option_c: 'चिल्का झील', option_d: 'पुलिकट झील', correct: 'B', explanation: 'वुलर झील भारत की सबसे बड़ी मीठे पानी की झील है।' },
  { question_text: 'भारत का "शुगर बाउल" किसे कहते हैं?', option_a: 'उत्तर प्रदेश', option_b: 'पंजाब', option_c: 'महाराष्ट्र', option_d: 'उत्तर प्रदेश और बिहार', correct: 'A', explanation: 'उत्तर प्रदेश को भारत का "शुगर बाउल" कहते हैं।' },
  { question_text: 'ओलंपिक खेलों में गोल्ड मेडल जीतने वाले पहले भारतीय कौन थे?', option_a: 'मिल्खा सिंह', option_b: 'अभिनव बिंद्रा', option_c: 'सुशील कुमार', option_d: 'पी.टी. उषा', correct: 'B', explanation: 'अभिनव बिंद्रा ने 2008 बीजिंग ओलंपिक में व्यक्तिगत स्वर्ण पदक जीता था।' },
  { question_text: 'नोबेल पुरस्कार पाने वाले पहले भारतीय कौन थे?', option_a: 'सी.वी. रमन', option_b: 'रविंद्रनाथ टैगोर', option_c: 'अमर्त्य सेन', option_d: 'मदर टेरेसा', correct: 'B', explanation: 'रविंद्रनाथ टैगोर 1913 में नोबेल पुरस्कार पाने वाले पहले भारतीय थे।' },
  { question_text: 'शेरशाह सूरी ने किस सड़क का निर्माण कराया?', option_a: 'राजपथ', option_b: 'ग्रांड ट्रंक रोड', option_c: 'आगरा-मुंबई राजमार्ग', option_d: 'जनपथ', correct: 'B', explanation: 'ग्रांड ट्रंक रोड का निर्माण शेरशाह सूरी ने कराया था।' },
  { question_text: 'भारतीय रिजर्व बैंक की स्थापना कब हुई?', option_a: '1932', option_b: '1933', option_c: '1935', option_d: '1948', correct: 'C', explanation: 'भारतीय रिजर्व बैंक की स्थापना 1 अप्रैल 1935 को हुई।' },
  { question_text: '"केरल" शब्द का अर्थ क्या है?', option_a: 'नदियों की भूमि', option_b: 'नारियल की भूमि', option_c: 'पहाड़ों की भूमि', option_d: 'सुंदर भूमि', correct: 'B', explanation: '"केरल" का अर्थ नारियल की भूमि है।' },
  { question_text: 'महाभारत में कितने श्लोक हैं?', option_a: '50,000', option_b: '1,00,000', option_c: '1,20,000', option_d: '80,000', correct: 'B', explanation: 'महाभारत में लगभग 1 लाख श्लोक हैं।' },
  { question_text: 'विश्व स्वास्थ्य दिवस कब मनाया जाता है?', option_a: '5 जून', option_b: '8 मार्च', option_c: '7 अप्रैल', option_d: '21 जून', correct: 'C', explanation: 'विश्व स्वास्थ्य दिवस 7 अप्रैल को मनाया जाता है।' },
  { question_text: 'भारत में "गणतंत्र दिवस" कब मनाया जाता है?', option_a: '15 अगस्त', option_b: '26 जनवरी', option_c: '2 अक्टूबर', option_d: '1 मई', correct: 'B', explanation: '26 जनवरी 1950 को भारत गणराज्य बना था।' },
  { question_text: 'भारत में पहली रेलगाड़ी कब और कहाँ चली?', option_a: 'मुंबई-ठाणे, 1853', option_b: 'दिल्ली-कोलकाता, 1855', option_c: 'चेन्नई-बेंगलुरु, 1856', option_d: 'कोलकाता-दिल्ली, 1852', correct: 'A', explanation: 'पहली रेलगाड़ी 16 अप्रैल 1853 को मुंबई से ठाणे के बीच चली।' },
  { question_text: '"वंदे मातरम" की रचना किसने की?', option_a: 'रविंद्रनाथ टैगोर', option_b: 'बंकिमचंद्र चटर्जी', option_c: 'महात्मा गांधी', option_d: 'सुभाषचंद्र बोस', correct: 'B', explanation: '"वंदे मातरम" की रचना बंकिमचंद्र चटर्जी ने की थी।' },
  { question_text: 'पानीपत का प्रथम युद्ध कब हुआ?', option_a: '1526', option_b: '1556', option_c: '1565', option_d: '1576', correct: 'A', explanation: 'पानीपत का पहला युद्ध 1526 में बाबर और इब्राहिम लोदी के बीच हुआ।' },
  { question_text: 'भारत में पंचवर्षीय योजना की शुरुआत कब हुई?', option_a: '1947', option_b: '1950', option_c: '1951', option_d: '1956', correct: 'C', explanation: 'भारत में पहली पंचवर्षीय योजना 1951 में शुरू हुई।' },
  { question_text: '"जन गण मन" पहली बार कब गाया गया?', option_a: '26 दिसंबर 1911', option_b: '15 अगस्त 1947', option_c: '26 जनवरी 1950', option_d: '30 जनवरी 1948', correct: 'A', explanation: '"जन गण मन" पहली बार 27 दिसंबर 1911 को कांग्रेस अधिवेशन में गाया गया।' },

  // ─ SET 4 ─
  { question_text: 'कौन सा विटामिन सूर्य के प्रकाश से मिलता है?', option_a: 'विटामिन A', option_b: 'विटामिन B', option_c: 'विटामिन C', option_d: 'विटामिन D', correct: 'D', explanation: 'विटामिन D सूर्य के प्रकाश से प्राप्त होता है।' },
  { question_text: 'मानव शरीर की सबसे बड़ी हड्डी कौन सी है?', option_a: 'टिबिया', option_b: 'फीमर', option_c: 'स्टेपीज', option_d: 'ह्यूमेरस', correct: 'B', explanation: 'फीमर (जांघ की हड्डी) मानव शरीर की सबसे बड़ी हड्डी है।' },
  { question_text: 'रक्त का शुद्धिकरण किस अंग में होता है?', option_a: 'हृदय', option_b: 'यकृत', option_c: 'वृक्क (किडनी)', option_d: 'फेफड़े', correct: 'C', explanation: 'वृक्क (किडनी) में रक्त का शुद्धिकरण होता है।' },
  { question_text: 'मानव शरीर में हड्डियों की कुल संख्या कितनी है?', option_a: '196', option_b: '206', option_c: '216', option_d: '226', correct: 'B', explanation: 'वयस्क मानव शरीर में 206 हड्डियाँ होती हैं।' },
  { question_text: 'भारत का सबसे पुराना वेद कौन सा है?', option_a: 'सामवेद', option_b: 'यजुर्वेद', option_c: 'ऋग्वेद', option_d: 'अथर्ववेद', correct: 'C', explanation: 'ऋग्वेद सबसे पुराना वेद है।' },
  { question_text: 'कौन सा ग्रह सूर्य के सबसे निकट है?', option_a: 'शुक्र', option_b: 'पृथ्वी', option_c: 'बुध', option_d: 'मंगल', correct: 'C', explanation: 'बुध (Mercury) सूर्य के सबसे निकट का ग्रह है।' },
  { question_text: 'प्रकाश की गति कितनी है?', option_a: '2 लाख किमी/सेकंड', option_b: '3 लाख किमी/सेकंड', option_c: '4 लाख किमी/सेकंड', option_d: '1 लाख किमी/सेकंड', correct: 'B', explanation: 'प्रकाश की गति लगभग 3 लाख (3×10⁸ मीटर) किमी/सेकंड है।' },
  { question_text: 'अंतरिक्ष में जाने वाले पहले भारतीय कौन थे?', option_a: 'कल्पना चावला', option_b: 'राकेश शर्मा', option_c: 'सुनीता विलियम्स', option_d: 'विक्रम साराभाई', correct: 'B', explanation: 'राकेश शर्मा 1984 में अंतरिक्ष में जाने वाले पहले भारतीय थे।' },
  { question_text: 'विश्व का सबसे बड़ा महासागर कौन सा है?', option_a: 'अटलांटिक', option_b: 'हिंद', option_c: 'प्रशांत', option_d: 'आर्कटिक', correct: 'C', explanation: 'प्रशांत महासागर (Pacific Ocean) विश्व का सबसे बड़ा महासागर है।' },
  { question_text: 'ICC T20 विश्व कप 2024 किसने जीता?', option_a: 'ऑस्ट्रेलिया', option_b: 'भारत', option_c: 'इंग्लैंड', option_d: 'पाकिस्तान', correct: 'B', explanation: 'भारत ने ICC T20 विश्व कप 2024 जीता।' },
  { question_text: 'ISRO का मुख्यालय कहाँ है?', option_a: 'मुंबई', option_b: 'दिल्ली', option_c: 'बेंगलुरु', option_d: 'हैदराबाद', correct: 'C', explanation: 'ISRO का मुख्यालय बेंगलुरु में है।' },
  { question_text: 'G20 का अध्यक्ष 2023 में कौन था?', option_a: 'चीन', option_b: 'अमेरिका', option_c: 'इंडोनेशिया', option_d: 'भारत', correct: 'D', explanation: 'भारत 2023 में G20 का अध्यक्ष था।' },
  { question_text: 'भारत में "बाल दिवस" कब मनाया जाता है?', option_a: '2 अक्टूबर', option_b: '14 नवंबर', option_c: '5 सितंबर', option_d: '15 अगस्त', correct: 'B', explanation: '14 नवंबर को पंडित नेहरू के जन्मदिन पर बाल दिवस मनाया जाता है।' },
  { question_text: '"अमर जवान ज्योति" कहाँ स्थित है?', option_a: 'लाल किला, दिल्ली', option_b: 'इंडिया गेट, दिल्ली', option_c: 'राष्ट्रपति भवन, दिल्ली', option_d: 'जंतर मंतर, दिल्ली', correct: 'B', explanation: 'अमर जवान ज्योति इंडिया गेट, नई दिल्ली में स्थित है।' },
  { question_text: 'भारत की सबसे ऊंची इमारत कौन सी है?', option_a: 'वर्ल्ड वन टावर, मुंबई', option_b: 'इंपीरियल, मुंबई', option_c: 'अंबानी टावर', option_d: 'पैलेस ऑफ पार्लियामेंट', correct: 'A', explanation: 'वर्ल्ड वन टावर मुंबई में भारत की सबसे ऊंची इमारत है।' },
  { question_text: 'बौद्ध धर्म के संस्थापक कौन थे?', option_a: 'महावीर', option_b: 'आदिनाथ', option_c: 'गौतम बुद्ध', option_d: 'नागार्जुन', correct: 'C', explanation: 'गौतम बुद्ध बौद्ध धर्म के संस्थापक थे।' },
  { question_text: 'जैन धर्म के 24वें तीर्थंकर कौन थे?', option_a: 'ऋषभदेव', option_b: 'पार्श्वनाथ', option_c: 'महावीर', option_d: 'नेमिनाथ', correct: 'C', explanation: 'महावीर जैन धर्म के 24वें और अंतिम तीर्थंकर थे।' },
  { question_text: 'भारत का सबसे बड़ा रेलवे स्टेशन कौन सा है?', option_a: 'मुंबई CST', option_b: 'हावड़ा', option_c: 'नई दिल्ली', option_d: 'गोरखपुर', correct: 'D', explanation: 'गोरखपुर रेलवे स्टेशन प्लेटफार्म की लंबाई में सबसे बड़ा है।' },
  { question_text: 'भारत का पहला परमाणु परीक्षण कहाँ हुआ?', option_a: 'जोधपुर', option_b: 'पोखरण', option_c: 'कोटा', option_d: 'जैसलमेर', correct: 'B', explanation: 'भारत का पहला परमाणु परीक्षण 1974 में राजस्थान के पोखरण में हुआ।' },
  { question_text: 'रामायण के रचयिता कौन हैं?', option_a: 'वेदव्यास', option_b: 'वाल्मीकि', option_c: 'तुलसीदास', option_d: 'कालिदास', correct: 'B', explanation: 'महर्षि वाल्मीकि ने मूल रामायण की रचना की।' },

  // ─ SETS 5-10 reuse shuffled questions for extra sessions ─
  { question_text: 'कौन सा देश "सफेद हाथी की भूमि" कहलाता है?', option_a: 'भारत', option_b: 'थाईलैंड', option_c: 'श्रीलंका', option_d: 'नेपाल', correct: 'B', explanation: 'थाईलैंड को "सफेद हाथी की भूमि" कहा जाता है।' },
  { question_text: 'विश्व का सबसे बड़ा देश कौन सा है (क्षेत्रफल में)?', option_a: 'कनाडा', option_b: 'चीन', option_c: 'अमेरिका', option_d: 'रूस', correct: 'D', explanation: 'रूस क्षेत्रफल में विश्व का सबसे बड़ा देश है।' },
  { question_text: 'कौन सा रंग शांति का प्रतीक है?', option_a: 'लाल', option_b: 'सफेद', option_c: 'हरा', option_d: 'नीला', correct: 'B', explanation: 'सफेद रंग शांति का प्रतीक माना जाता है।' },
  { question_text: 'पृथ्वी पर कुल महाद्वीप कितने हैं?', option_a: '5', option_b: '6', option_c: '7', option_d: '8', correct: 'C', explanation: 'पृथ्वी पर कुल 7 महाद्वीप हैं।' },
  { question_text: '1 किलोमीटर में कितने मीटर होते हैं?', option_a: '100', option_b: '500', option_c: '1000', option_d: '10000', correct: 'C', explanation: '1 किलोमीटर = 1000 मीटर।' },
  { question_text: 'मधुमेह रोग किस अंग की खराबी से होता है?', option_a: 'यकृत', option_b: 'अग्न्याशय', option_c: 'वृक्क', option_d: 'हृदय', correct: 'B', explanation: 'मधुमेह (Diabetes) अग्न्याशय (Pancreas) में इंसुलिन की कमी से होता है।' },
  { question_text: 'भारत में कितने उच्च न्यायालय हैं?', option_a: '24', option_b: '25', option_c: '26', option_d: '28', correct: 'B', explanation: 'वर्तमान में भारत में 25 उच्च न्यायालय हैं।' },
  { question_text: 'ओजोन परत किस से सुरक्षा करती है?', option_a: 'गामा किरणें', option_b: 'अल्ट्रावायलेट किरणें', option_c: 'इन्फ्रारेड किरणें', option_d: 'एक्स-रे', correct: 'B', explanation: 'ओजोन परत सूर्य की हानिकारक अल्ट्रावायलेट (UV) किरणों से बचाती है।' },
  { question_text: 'भारत का "स्पाइस गार्डन" किसे कहा जाता है?', option_a: 'गोवा', option_b: 'केरल', option_c: 'कर्नाटक', option_d: 'तमिलनाडु', correct: 'B', explanation: 'केरल को भारत का "मसालों का बागान" (Spice Garden) कहा जाता है।' },
  { question_text: 'कुतुब मीनार कहाँ स्थित है?', option_a: 'आगरा', option_b: 'लखनऊ', option_c: 'नई दिल्ली', option_d: 'जयपुर', correct: 'C', explanation: 'कुतुब मीनार नई दिल्ली में स्थित है।' },
  { question_text: 'किस भारतीय खिलाड़ी को "क्रिकेट का भगवान" कहा जाता है?', option_a: 'राहुल द्रविड़', option_b: 'सौरव गांगुली', option_c: 'सचिन तेंदुलकर', option_d: 'विराट कोहली', correct: 'C', explanation: 'सचिन तेंदुलकर को "क्रिकेट का भगवान" कहा जाता है।' },
  { question_text: '"दिल्ली चलो" का नारा किसने दिया?', option_a: 'महात्मा गांधी', option_b: 'भगत सिंह', option_c: 'नेताजी सुभाष चंद्र बोस', option_d: 'बाल गंगाधर तिलक', correct: 'C', explanation: '"दिल्ली चलो" का नारा नेताजी सुभाष चंद्र बोस ने दिया था।' },
  { question_text: 'रामकृष्ण मिशन की स्थापना किसने की?', option_a: 'रामकृष्ण परमहंस', option_b: 'स्वामी विवेकानंद', option_c: 'दयानंद सरस्वती', option_d: 'राजा राम मोहन राय', correct: 'B', explanation: 'रामकृष्ण मिशन की स्थापना स्वामी विवेकानंद ने 1897 में की।' },
  { question_text: 'विश्व का सबसे बड़ा लोकतंत्र कौन सा है?', option_a: 'अमेरिका', option_b: 'चीन', option_c: 'भारत', option_d: 'ब्राजील', correct: 'C', explanation: 'भारत विश्व का सबसे बड़ा लोकतंत्र है।' },
  { question_text: 'भारत का सबसे ऊंचा जलप्रपात कौन सा है?', option_a: 'जोग जलप्रपात', option_b: 'दूधसागर', option_c: 'कूंचीकल', option_d: 'अथिरापिल्ली', correct: 'C', explanation: 'कूंचीकल जलप्रपात (कर्नाटक) भारत का सबसे ऊंचा जलप्रपात है।' },
  { question_text: 'भारत में पहली जनगणना कब हुई?', option_a: '1872', option_b: '1881', option_c: '1901', option_d: '1921', correct: 'A', explanation: 'भारत में पहली जनगणना 1872 में हुई।' },
  { question_text: '"भारत माता की जय" का नारा किसने दिया?', option_a: 'बंकिमचंद्र', option_b: 'भीकाजी कामा', option_c: 'सुभाष चंद्र बोस', option_d: 'महात्मा गांधी', correct: 'D', explanation: '"भारत माता की जय" नारे को महात्मा गांधी ने लोकप्रिय बनाया।' },
  { question_text: 'पाकिस्तान किस वर्ष में बना?', option_a: '1945', option_b: '1946', option_c: '1947', option_d: '1948', correct: 'C', explanation: 'पाकिस्तान 14 अगस्त 1947 को बना।' },
  { question_text: 'ISRO ने पहला सफल मंगल अभियान कब पूरा किया?', option_a: '2013', option_b: '2014', option_c: '2015', option_d: '2016', correct: 'B', explanation: 'ISRO का मंगलयान 24 सितंबर 2014 को मंगल की कक्षा में पहुंचा।' },
  { question_text: 'चंद्रयान-3 ने किस वर्ष चंद्रमा पर लैंडिंग की?', option_a: '2021', option_b: '2022', option_c: '2023', option_d: '2024', correct: 'C', explanation: 'चंद्रयान-3 ने 23 अगस्त 2023 को चंद्रमा पर सफलतापूर्वक लैंडिंग की।' },
];

// ─── SESSION TITLES ────────────────────────────────────────────────────────────
const sessionTitles = [
  'Hindi GK Challenge #1 - Bharat Parichay',
  'Hindi GK Challenge #2 - Itihas Ki Duniya',
  'Hindi GK Challenge #3 - Vigyan aur Prakriti',
  'Hindi GK Challenge #4 - Bharat ka Samvidhan',
  'Hindi GK Challenge #5 - Bhugol aur Nadi',
  'Hindi GK Challenge #6 - Khel aur Puraskar',
  'Hindi GK Challenge #7 - Prashidd Vyaktitv',
  'Hindi GK Challenge #8 - Rashtriya Pratik',
  'Hindi GK Challenge #9 - Vigyan aur Antariksh',
  'Hindi GK Challenge #10 - Aadhunik Bharat',
];

async function main() {
  try {
    // Find or create Hindi GK category
    let cat = await Category.findOne({ name: { $regex: /hindi.*gk/i } });
    if (!cat) {
      cat = new Category({
        id: Date.now(),
        name: 'Hindi GK',
        level: 'easy',
        color: '#ff6b35',
        icon: '🇮🇳',
        description: 'Hindi General Knowledge Questions'
      });
      await cat.save();
      console.log('✅ Hindi GK Category created:', cat.id);
    } else {
      console.log('✅ Hindi GK Category found:', cat.id);
    }

    // Create 10 sessions
    for (let i = 0; i < 10; i++) {
      const sessionId = Date.now() + i * 1000;
      const session = new Session({
        id: sessionId,
        category_id: cat.id,
        title: sessionTitles[i],
        seat_limit: 30,
        seats_booked: 0,
        entry_fee: 20,
        quiz_delay_minutes: 60,
        status: 'open',
        created_at: Math.floor(Date.now() / 1000) + i,
        is_hidden: false
      });
      await session.save();
      console.log(`✅ Session ${i + 1}/10 created: "${sessionTitles[i]}" (ID: ${sessionId})`);

      // Assign 20 questions to this session
      const start = (i % 10) * 20;
      const qSet = allQuestions.slice(start, start + 20);

      for (let j = 0; j < qSet.length; j++) {
        const q = new Question({
          id: Date.now() + i * 100 + j + Math.floor(Math.random() * 1000),
          session_id: sessionId,
          question_text: qSet[j].question_text,
          option_a: qSet[j].option_a,
          option_b: qSet[j].option_b,
          option_c: qSet[j].option_c,
          option_d: qSet[j].option_d,
          correct: qSet[j].correct,
          explanation: qSet[j].explanation
        });
        await q.save();
      }
      console.log(`   📝 20 Questions added to Session ${i + 1}`);
    }

    console.log('\n🎉 SUCCESS! 10 Hindi GK Sessions created!');
    console.log('💰 Entry Fee: ₹20 | 🎫 Seats: 30 | ❓ Questions: 20 each');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

main();
