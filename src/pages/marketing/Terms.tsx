import useSEO from '../../hooks/useSEO';

export default function Terms() {
  useSEO('תנאי שימוש | Quieteyes', 'תנאי השימוש של Quieteyes');

  return (
    <div className="pt-16">
      <section className="py-20">
        <div className="max-w-[800px] mx-auto px-6" dir="rtl">
          <h1 className="text-3xl font-extrabold mb-8" style={{ color: '#f0f4ff' }}>תנאי שימוש</h1>
          <div className="space-y-6 text-sm leading-relaxed" style={{ color: '#8899aa' }}>
            <p>עודכן לאחרונה: פברואר 2026</p>

            <h2 className="text-lg font-bold" style={{ color: '#f0f4ff' }}>1. כללי</h2>
            <p>Quieteyes ("השירות") הינה פלטפורמת מודיעין עסקי המופעלת על ידי Quieteyes Ltd. השימוש בשירות כפוף לתנאים אלה.</p>

            <h2 className="text-lg font-bold" style={{ color: '#f0f4ff' }}>2. הרשמה וחשבון</h2>
            <p>עליך לספק מידע מדויק בעת ההרשמה. אתה אחראי לשמירת סיסמת החשבון שלך ולכל פעולה שנעשית בחשבונך.</p>

            <h2 className="text-lg font-bold" style={{ color: '#f0f4ff' }}>3. שימוש מותר</h2>
            <p>השירות מיועד לשימוש עסקי חוקי בלבד. אין להשתמש בשירות לצורך: פעילות בלתי חוקית, הטרדה, הפרת פרטיות, או כל שימוש שעלול לפגוע בצדדים שלישיים.</p>

            <h2 className="text-lg font-bold" style={{ color: '#f0f4ff' }}>4. תקופת ניסיון</h2>
            <p>תקופת הניסיון היא 14 ימים. בתום תקופת הניסיון, יש לבחור תוכנית בתשלום להמשך שימוש.</p>

            <h2 className="text-lg font-bold" style={{ color: '#f0f4ff' }}>5. תשלומים</h2>
            <p>התשלום נגבה מראש, חודשי או שנתי, בהתאם לתוכנית שנבחרה. ניתן לבטל מנוי בכל עת. ביטול ייכנס לתוקף בתום תקופת החיוב הנוכחית.</p>

            <h2 className="text-lg font-bold" style={{ color: '#f0f4ff' }}>6. קניין רוחני</h2>
            <p>כל הזכויות בשירות, כולל קוד, עיצוב ותוכן, שייכות ל-Quieteyes. המידע העסקי שלך נשאר בבעלותך.</p>

            <h2 className="text-lg font-bold" style={{ color: '#f0f4ff' }}>7. הגבלת אחריות</h2>
            <p>השירות מסופק "כמות שהוא" (AS IS). Quieteyes אינה אחראית לנזקים ישירים או עקיפים הנובעים משימוש בשירות. המידע המסופק הוא בגדר המלצה בלבד ואינו מהווה ייעוץ מקצועי.</p>

            <h2 className="text-lg font-bold" style={{ color: '#f0f4ff' }}>8. יצירת קשר</h2>
            <p>לשאלות בנוגע לתנאי השימוש: <a href="mailto:hello@quieteyes.co.il" style={{ color: '#00d4ff' }}>hello@quieteyes.co.il</a></p>
          </div>
        </div>
      </section>
    </div>
  );
}
