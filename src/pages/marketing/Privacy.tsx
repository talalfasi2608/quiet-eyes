import useSEO from '../../hooks/useSEO';

export default function Privacy() {
  useSEO('מדיניות פרטיות | Quieteyes', 'מדיניות הפרטיות של Quieteyes');

  return (
    <div className="pt-16">
      <section className="py-20">
        <div className="max-w-[800px] mx-auto px-6" dir="rtl">
          <h1 className="text-3xl font-extrabold mb-8" style={{ color: '#f0f4ff' }}>מדיניות פרטיות</h1>
          <div className="space-y-6 text-sm leading-relaxed" style={{ color: '#8899aa' }}>
            <p>עודכן לאחרונה: פברואר 2026</p>

            <h2 className="text-lg font-bold" style={{ color: '#f0f4ff' }}>1. מידע שאנו אוספים</h2>
            <p>אנו אוספים מידע שאתה מספק לנו ישירות: שם, כתובת אימייל, מספר טלפון, פרטי עסק (שם העסק, כתובת, תחום פעילות). בנוסף, אנו אוספים מידע ציבורי על מתחרים מהאינטרנט לצורך ניתוח שוק.</p>

            <h2 className="text-lg font-bold" style={{ color: '#f0f4ff' }}>2. שימוש במידע</h2>
            <p>המידע משמש לצורך: אספקת שירותי מודיעין עסקי, ניתוח מתחרים, זיהוי לידים פוטנציאליים, שליחת התראות (WhatsApp, אימייל), שיפור השירות.</p>

            <h2 className="text-lg font-bold" style={{ color: '#f0f4ff' }}>3. אבטחת מידע</h2>
            <p>אנו משתמשים באמצעי אבטחה מתקדמים כולל הצפנת SSL, אימות דו-שלבי, ושמירת נתונים בשרתים מאובטחים של Supabase.</p>

            <h2 className="text-lg font-bold" style={{ color: '#f0f4ff' }}>4. שיתוף מידע</h2>
            <p>איננו מוכרים או משתפים את המידע האישי שלך עם צדדים שלישיים למטרות שיווקיות. מידע עשוי להיות משותף עם ספקי שירות (כגון Supabase, Anthropic) לצורך הפעלת השירות בלבד.</p>

            <h2 className="text-lg font-bold" style={{ color: '#f0f4ff' }}>5. זכויות המשתמש</h2>
            <p>בהתאם לחוק הגנת הפרטיות, יש לך זכות לעיין במידע השמור עליך, לבקש תיקון או מחיקה. לכל בקשה ניתן לפנות אלינו בכתובת: hello@quieteyes.co.il</p>

            <h2 className="text-lg font-bold" style={{ color: '#f0f4ff' }}>6. Cookies</h2>
            <p>אנו משתמשים ב-Cookies לצורך אימות משתמשים ושמירת העדפות. ניתן לנהל את הגדרות ה-Cookies דרך הדפדפן.</p>

            <h2 className="text-lg font-bold" style={{ color: '#f0f4ff' }}>7. יצירת קשר</h2>
            <p>לשאלות בנוגע למדיניות הפרטיות, ניתן לפנות אלינו: <a href="mailto:hello@quieteyes.co.il" style={{ color: '#00d4ff' }}>hello@quieteyes.co.il</a></p>
          </div>
        </div>
      </section>
    </div>
  );
}
