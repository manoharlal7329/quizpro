const mongoose = require('mongoose');
const Category = require('./database/models/Category');
const Session = require('./database/models/Session');
const Question = require('./database/models/Question');

async function autoSeed() {
  try {
    const existing = await Session.findOne({ title: 'Hindi GK Pro #1' });
    if (existing) {
      console.log('Auto-seed: 50rs sessions already exist, skipping.');
      return;
    }

    console.log('Auto-seed: Generating 20 new 50rs sessions (10 GK, 10 Math)...');

    // GK Category
    let gkCat = await Category.findOne({ name: 'GK Pro' });
    if (!gkCat) {
      gkCat = new Category({
        id: Date.now(), name: 'GK Pro', level: 'medium', color: '#ff6b35', icon: '🇮🇳', description: 'Hindi General Knowledge (Rs 50)'
      });
      await gkCat.save();
    }

    // Math Category
    let mathCat = await Category.findOne({ name: 'Math Pro' });
    if (!mathCat) {
      mathCat = new Category({
        id: Date.now() + 1, name: 'Math Pro', level: 'medium', color: '#3b82f6', icon: '🔢', description: 'Hindi Mathematics (Rs 50)'
      });
      await mathCat.save();
    }

    const gkQuestions = [
      { q: 'भारत की राजधानी क्या है?', a: 'मुंबई', b: 'नई दिल्ली', c: 'कोलकाता', d: 'चेन्नई', ans: 'B', exp: 'नई दिल्ली भारत की राजधानी है।' },
      { q: 'भारत का राष्ट्रीय पशु क्या है?', a: 'शेर', b: 'बाघ', c: 'हाथी', d: 'भालू', ans: 'B', exp: 'बाघ भारत का राष्ट्रीय पशु है।' },
      { q: 'भारत का राष्ट्रीय पक्षी क्या है?', a: 'मोर', b: 'तोता', c: 'कबूतर', d: 'हंस', ans: 'A', exp: 'मोर भारत का राष्ट्रीय पक्षी है।' },
      { q: 'ताजमहल कहाँ है?', a: 'दिल्ली', b: 'जयपुर', c: 'आगरा', d: 'कानपुर', ans: 'C', exp: 'ताजमहल आगरा में है।' },
      { q: 'भारत का सबसे बड़ा राज्य (क्षेत्रफल) कौन सा है?', a: 'राजस्थान', b: 'उत्तर प्रदेश', c: 'महाराष्ट्र', d: 'मध्य प्रदेश', ans: 'A', exp: 'राजस्थान सबसे बड़ा राज्य है।' },
      { q: 'महात्मा गांधी का जन्म कहाँ हुआ था?', a: 'राजकोट', b: 'पोरबंदर', c: 'अहमदाबाद', d: 'सूरत', ans: 'B', exp: 'पोरबंदर में महात्मा गांधी का जन्म हुआ था।' },
      { q: 'भारत में कितने राज्य हैं?', a: '27', b: '28', c: '29', d: '30', ans: 'B', exp: 'भारत में 28 राज्य हैं।' },
      { q: 'भारत की सबसे लंबी नदी कौन सी है?', a: 'यमुना', b: 'गंगा', c: 'गोदावरी', d: 'कृष्णा', ans: 'B', exp: 'गंगा सबसे लंबी नदी है।' },
      { q: 'स्वतंत्रता दिवस कब मनाया जाता है?', a: '26 जनवरी', b: '15 अगस्त', c: '2 अक्टूबर', d: '14 नवंबर', ans: 'B', exp: '15 अगस्त को स्वतंत्रता दिवस मनाया जाता है।' },
      { q: 'भारत का राष्ट्रीय गीत क्या है?', a: 'जन गण मन', b: 'वंदे मातरम', c: 'सारे जहाँ से अच्छा', d: 'विजयी विश्व तिरंगा प्यारा', ans: 'B', exp: 'वंदे मातरम राष्ट्रीय गीत है।' }
    ];

    const mathQuestions = [
      { q: '5 + 7 = ?', a: '11', b: '12', c: '13', d: '14', ans: 'B', exp: '5 + 7 = 12' },
      { q: '12 × 5 = ?', a: '50', b: '60', c: '70', d: '80', ans: 'B', exp: '12 × 5 = 60' },
      { q: '100 - 35 = ?', a: '55', b: '60', c: '65', d: '75', ans: 'C', exp: '100 - 35 = 65' },
      { q: '25 ÷ 5 = ?', a: '3', b: '4', c: '5', d: '6', ans: 'C', exp: '25 ÷ 5 = 5' },
      { q: '15 का वर्ग (Square) क्या है?', a: '125', b: '225', c: '150', d: '300', ans: 'B', exp: '15 × 15 = 225' },
      { q: '8 + 8 + 8 = ?', a: '16', b: '24', c: '32', d: '40', ans: 'B', exp: '8 × 3 = 24' },
      { q: '1 किलोमीटर में कितने मीटर होते हैं?', a: '100', b: '500', c: '1000', d: '10000', ans: 'C', exp: '1 किलोमीटर = 1000 मीटर' },
      { q: '1 घंटे में कितने मिनट होते हैं?', a: '30', b: '45', c: '60', d: '90', ans: 'C', exp: '1 घंटे में 60 मिनट होते हैं' },
      { q: '20 का आधा क्या है?', a: '5', b: '10', c: '15', d: '25', ans: 'B', exp: '20 ÷ 2 = 10' },
      { q: '4 × 4 = ?', a: '8', b: '12', c: '16', d: '20', ans: 'C', exp: '4 × 4 = 16' }
    ];

    let count = 0;
    
    // Seed 10 GK Sessions
    for (let i = 0; i < 10; i++) {
      const sessionId = Date.now() + i * 1000;
      const session = new Session({
        id: sessionId,
        category_id: gkCat.id,
        title: `Hindi GK Pro #${i + 1}`,
        seat_limit: 30,
        seats_booked: 0,
        entry_fee: 50,
        quiz_delay_minutes: 60,
        status: 'open',
        created_at: Math.floor(Date.now() / 1000) + i,
        is_hidden: false
      });
      await session.save();

      for (let j = 0; j < 10; j++) {
        const q = new Question({
          id: Date.now() + i * 100 + j + Math.floor(Math.random() * 1000),
          session_id: sessionId,
          question_text: gkQuestions[j].q,
          option_a: gkQuestions[j].a,
          option_b: gkQuestions[j].b,
          option_c: gkQuestions[j].c,
          option_d: gkQuestions[j].d,
          correct: gkQuestions[j].ans,
          explanation: gkQuestions[j].exp
        });
        await q.save();
      }
      count++;
    }

    // Seed 10 Math Sessions
    for (let i = 0; i < 10; i++) {
      const sessionId = Date.now() + 100000 + i * 1000;
      const session = new Session({
        id: sessionId,
        category_id: mathCat.id,
        title: `Hindi Math Pro #${i + 1}`,
        seat_limit: 30,
        seats_booked: 0,
        entry_fee: 50,
        quiz_delay_minutes: 60,
        status: 'open',
        created_at: Math.floor(Date.now() / 1000) + i + 10,
        is_hidden: false
      });
      await session.save();

      for (let j = 0; j < 10; j++) {
        const q = new Question({
          id: Date.now() + 200000 + i * 100 + j + Math.floor(Math.random() * 1000),
          session_id: sessionId,
          question_text: mathQuestions[j].q,
          option_a: mathQuestions[j].a,
          option_b: mathQuestions[j].b,
          option_c: mathQuestions[j].c,
          option_d: mathQuestions[j].d,
          correct: mathQuestions[j].ans,
          explanation: mathQuestions[j].exp
        });
        await q.save();
      }
      count++;
    }

    console.log(`Auto-seed: Successfully created ${count} sessions with 30 seats and 50rs entry fee!`);
  } catch (e) {
    console.error('Auto-seed Error:', e);
  }
}

module.exports = autoSeed;
