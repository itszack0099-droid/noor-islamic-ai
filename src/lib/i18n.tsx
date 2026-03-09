import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LangCode = "en" | "ar" | "fr" | "tr" | "id" | "bn" | "de" | "es" | "ru" | "ur";

export interface Language {
  code: LangCode;
  label: string;
  flag: string;
  rtl: boolean;
  quranEdition: string;
  hadithPrefix: string; // e.g. "eng", "urd", "ara" — used as {prefix}-bukhari etc.
}

export const LANGUAGES: Language[] = [
  { code: "en", label: "English", flag: "🇬🇧", rtl: false, quranEdition: "en.asad", hadithPrefix: "eng" },
  { code: "ar", label: "العربية", flag: "🇸🇦", rtl: true, quranEdition: "ar.muyassar", hadithPrefix: "ara" },
  { code: "fr", label: "Français", flag: "🇫🇷", rtl: false, quranEdition: "fr.hamidullah", hadithPrefix: "eng" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷", rtl: false, quranEdition: "tr.ates", hadithPrefix: "eng" },
  { code: "id", label: "Indonesian", flag: "🇮🇩", rtl: false, quranEdition: "id.indonesian", hadithPrefix: "eng" },
  { code: "bn", label: "বাংলা", flag: "🇧🇩", rtl: false, quranEdition: "bn.bengali", hadithPrefix: "eng" },
  { code: "de", label: "Deutsch", flag: "🇩🇪", rtl: false, quranEdition: "de.bubenheim", hadithPrefix: "eng" },
  { code: "es", label: "Español", flag: "🇪🇸", rtl: false, quranEdition: "es.cortes", hadithPrefix: "eng" },
  { code: "ru", label: "Русский", flag: "🇷🇺", rtl: false, quranEdition: "ru.kuliev", hadithPrefix: "eng" },
  { code: "ur", label: "اردو", flag: "🇮🇳", rtl: true, quranEdition: "ur.jalandhry", hadithPrefix: "urd" },
];

const translations: Record<LangCode, Record<string, string>> = {
  en: {
    home: "Home", quran: "Quran", hadith: "Hadith", search: "Search", ai: "AI",
    settings: "Settings", notifications: "Notifications", progress: "Progress",
    language: "Language", secondaryLanguage: "Secondary Translation",
    none: "None", bookmarks: "Bookmarks", bookmark: "Bookmark",
    share: "Share", play: "Play", pause: "Pause", download: "Download",
    loadMore: "Load More", noResults: "No results found",
    searchPlaceholder: "Search Quran, Hadith…",
    ayahOfDay: "Ayah of the Day", streak: "7-Day Streak",
    askAnything: "Ask anything about Islam…",
    nooraiScholar: "NoorAI Scholar", duaFinder: "Dua Finder",
    continueReading: "Continue Reading", memorized: "Memorized",
    needsReview: "Needs Review", notStarted: "Not Started",
    hifzProgress: "Hifz Progress", hifzMode: "Hifz Mode",
    markMemorized: "Mark as Memorized", tryAgain: "Try Again",
    verifyHadith: "Verify Hadith", prayerTimes: "Prayer Times",
    enterCity: "Enter your city for prayer times",
    fetchingPrayer: "Fetching prayer times…",
    savedBookmarks: "Saved Bookmarks", noBookmarks: "No bookmarks yet",
    removeBookmark: "Remove", quranProgress: "Quran Progress",
    hadithProgress: "Hadith Progress", noorScore: "Noor Score",
    badges: "Badges", online: "Online — Ready to help",
    hadithLibrary: "Hadith Library", allBooks: "All Books",
    loadMoreHadith: "Load More Ahadith",
    selectLanguage: "Select Language",
    appLanguage: "App Language",
    quranTranslation: "Quran Translation",
    back: "Back",
  },
  ar: {
    home: "الرئيسية", quran: "القرآن", hadith: "الحديث", search: "بحث", ai: "ذكاء",
    settings: "الإعدادات", notifications: "الإشعارات", progress: "التقدم",
    language: "اللغة", secondaryLanguage: "ترجمة ثانوية",
    none: "لا شيء", bookmarks: "المفضلة", bookmark: "إشارة مرجعية",
    share: "مشاركة", play: "تشغيل", pause: "إيقاف", download: "تحميل",
    loadMore: "تحميل المزيد", noResults: "لا توجد نتائج",
    searchPlaceholder: "ابحث في القرآن والحديث…",
    ayahOfDay: "آية اليوم", streak: "سلسلة ٧ أيام",
    askAnything: "اسأل أي شيء عن الإسلام…",
    nooraiScholar: "عالم نور", duaFinder: "باحث الدعاء",
    continueReading: "متابعة القراءة", memorized: "محفوظ",
    needsReview: "يحتاج مراجعة", notStarted: "لم يبدأ",
    hifzProgress: "تقدم الحفظ", hifzMode: "وضع الحفظ",
    markMemorized: "تحديد كمحفوظ", tryAgain: "حاول مرة أخرى",
    verifyHadith: "تحقق من الحديث", prayerTimes: "مواقيت الصلاة",
    enterCity: "أدخل مدينتك لمواقيت الصلاة",
    fetchingPrayer: "جاري تحميل مواقيت الصلاة…",
    savedBookmarks: "المفضلة المحفوظة", noBookmarks: "لا توجد مفضلات بعد",
    removeBookmark: "إزالة", quranProgress: "تقدم القرآن",
    hadithProgress: "تقدم الحديث", noorScore: "نقاط نور",
    badges: "الشارات", online: "متصل — جاهز للمساعدة",
    hadithLibrary: "مكتبة الحديث", allBooks: "جميع الكتب",
    loadMoreHadith: "تحميل المزيد من الأحاديث",
    selectLanguage: "اختر اللغة",
    appLanguage: "لغة التطبيق",
    quranTranslation: "ترجمة القرآن",
    back: "رجوع",
  },
  fr: {
    home: "Accueil", quran: "Coran", hadith: "Hadith", search: "Recherche", ai: "IA",
    settings: "Paramètres", notifications: "Notifications", progress: "Progrès",
    language: "Langue", secondaryLanguage: "Traduction secondaire",
    none: "Aucune", bookmarks: "Favoris", bookmark: "Favori",
    share: "Partager", play: "Lire", pause: "Pause", download: "Télécharger",
    loadMore: "Charger plus", noResults: "Aucun résultat",
    searchPlaceholder: "Rechercher Coran, Hadith…",
    ayahOfDay: "Verset du jour", streak: "Série de 7 jours",
    askAnything: "Posez une question sur l'Islam…",
    nooraiScholar: "NoorAI Scholar", duaFinder: "Chercheur de Dua",
    continueReading: "Continuer la lecture", memorized: "Mémorisé",
    needsReview: "À revoir", notStarted: "Non commencé",
    hifzProgress: "Progrès Hifz", hifzMode: "Mode Hifz",
    markMemorized: "Marquer comme mémorisé", tryAgain: "Réessayer",
    verifyHadith: "Vérifier le Hadith", prayerTimes: "Heures de prière",
    enterCity: "Entrez votre ville", fetchingPrayer: "Chargement…",
    savedBookmarks: "Favoris sauvegardés", noBookmarks: "Pas encore de favoris",
    removeBookmark: "Supprimer", quranProgress: "Progrès Coran",
    hadithProgress: "Progrès Hadith", noorScore: "Score Noor",
    badges: "Badges", online: "En ligne — Prêt à aider",
    hadithLibrary: "Bibliothèque Hadith", allBooks: "Tous les livres",
    loadMoreHadith: "Charger plus de Hadiths",
    selectLanguage: "Sélectionner la langue",
    appLanguage: "Langue de l'application",
    quranTranslation: "Traduction du Coran",
    back: "Retour",
  },
  tr: {
    home: "Ana Sayfa", quran: "Kur'an", hadith: "Hadis", search: "Ara", ai: "YZ",
    settings: "Ayarlar", notifications: "Bildirimler", progress: "İlerleme",
    language: "Dil", secondaryLanguage: "İkincil Çeviri",
    none: "Yok", bookmarks: "Yer İmleri", bookmark: "Yer İmi",
    share: "Paylaş", play: "Oynat", pause: "Durdur", download: "İndir",
    loadMore: "Daha Fazla", noResults: "Sonuç bulunamadı",
    searchPlaceholder: "Kur'an, Hadis ara…",
    ayahOfDay: "Günün Ayeti", streak: "7 Günlük Seri",
    askAnything: "İslam hakkında herhangi bir şey sorun…",
    nooraiScholar: "NoorAI Scholar", duaFinder: "Dua Bulucu",
    continueReading: "Okumaya Devam", memorized: "Ezberlenmiş",
    needsReview: "Tekrar Gerekli", notStarted: "Başlanmadı",
    hifzProgress: "Hıfz İlerlemesi", hifzMode: "Hıfz Modu",
    markMemorized: "Ezberlenmiş İşaretle", tryAgain: "Tekrar Dene",
    verifyHadith: "Hadis Doğrula", prayerTimes: "Namaz Vakitleri",
    enterCity: "Şehrinizi girin", fetchingPrayer: "Yükleniyor…",
    savedBookmarks: "Kaydedilen Yer İmleri", noBookmarks: "Henüz yer imi yok",
    removeBookmark: "Kaldır", quranProgress: "Kur'an İlerlemesi",
    hadithProgress: "Hadis İlerlemesi", noorScore: "Noor Puanı",
    badges: "Rozetler", online: "Çevrimiçi — Yardıma hazır",
    hadithLibrary: "Hadis Kütüphanesi", allBooks: "Tüm Kitaplar",
    loadMoreHadith: "Daha Fazla Hadis Yükle",
    selectLanguage: "Dil Seçin",
    appLanguage: "Uygulama Dili",
    quranTranslation: "Kur'an Çevirisi",
    back: "Geri",
  },
  id: {
    home: "Beranda", quran: "Quran", hadith: "Hadits", search: "Cari", ai: "AI",
    settings: "Pengaturan", notifications: "Notifikasi", progress: "Kemajuan",
    language: "Bahasa", secondaryLanguage: "Terjemahan Kedua",
    none: "Tidak ada", bookmarks: "Penanda", bookmark: "Tandai",
    share: "Bagikan", play: "Putar", pause: "Jeda", download: "Unduh",
    loadMore: "Muat Lebih", noResults: "Tidak ada hasil",
    searchPlaceholder: "Cari Quran, Hadits…",
    ayahOfDay: "Ayat Hari Ini", streak: "Streak 7 Hari",
    askAnything: "Tanya apa saja tentang Islam…",
    nooraiScholar: "NoorAI Scholar", duaFinder: "Pencari Doa",
    continueReading: "Lanjut Membaca", memorized: "Dihafal",
    needsReview: "Perlu Review", notStarted: "Belum Mulai",
    hifzProgress: "Kemajuan Hafalan", hifzMode: "Mode Hafalan",
    markMemorized: "Tandai Hafal", tryAgain: "Coba Lagi",
    verifyHadith: "Verifikasi Hadits", prayerTimes: "Waktu Shalat",
    enterCity: "Masukkan kota Anda", fetchingPrayer: "Memuat…",
    savedBookmarks: "Penanda Tersimpan", noBookmarks: "Belum ada penanda",
    removeBookmark: "Hapus", quranProgress: "Kemajuan Quran",
    hadithProgress: "Kemajuan Hadits", noorScore: "Skor Noor",
    badges: "Lencana", online: "Online — Siap membantu",
    hadithLibrary: "Perpustakaan Hadits", allBooks: "Semua Kitab",
    loadMoreHadith: "Muat Lebih Banyak Hadits",
    selectLanguage: "Pilih Bahasa",
    appLanguage: "Bahasa Aplikasi",
    quranTranslation: "Terjemahan Quran",
    back: "Kembali",
  },
  bn: {
    home: "হোম", quran: "কুরআন", hadith: "হাদিস", search: "খুঁজুন", ai: "এআই",
    settings: "সেটিংস", notifications: "বিজ্ঞপ্তি", progress: "অগ্রগতি",
    language: "ভাষা", secondaryLanguage: "দ্বিতীয় অনুবাদ",
    none: "নেই", bookmarks: "বুকমার্ক", bookmark: "বুকমার্ক",
    share: "শেয়ার", play: "চালান", pause: "বিরতি", download: "ডাউনলোড",
    loadMore: "আরও লোড", noResults: "কোন ফলাফল নেই",
    searchPlaceholder: "কুরআন, হাদিস খুঁজুন…",
    ayahOfDay: "আজকের আয়াত", streak: "৭ দিনের স্ট্রিক",
    askAnything: "ইসলাম সম্পর্কে যেকোনো প্রশ্ন করুন…",
    nooraiScholar: "NoorAI Scholar", duaFinder: "দোয়া খুঁজুন",
    continueReading: "পড়া চালিয়ে যান", memorized: "মুখস্থ",
    needsReview: "পর্যালোচনা প্রয়োজন", notStarted: "শুরু হয়নি",
    hifzProgress: "হিফজ অগ্রগতি", hifzMode: "হিফজ মোড",
    markMemorized: "মুখস্থ হিসেবে চিহ্নিত", tryAgain: "আবার চেষ্টা",
    verifyHadith: "হাদিস যাচাই", prayerTimes: "নামাজের সময়",
    enterCity: "আপনার শহর লিখুন", fetchingPrayer: "লোড হচ্ছে…",
    savedBookmarks: "সংরক্ষিত বুকমার্ক", noBookmarks: "এখনো কোন বুকমার্ক নেই",
    removeBookmark: "মুছুন", quranProgress: "কুরআন অগ্রগতি",
    hadithProgress: "হাদিস অগ্রগতি", noorScore: "নূর স্কোর",
    badges: "ব্যাজ", online: "অনলাইন — সাহায্য করতে প্রস্তুত",
    hadithLibrary: "হাদিস লাইব্রেরি", allBooks: "সব বই",
    loadMoreHadith: "আরো হাদিস লোড করুন",
    selectLanguage: "ভাষা নির্বাচন করুন",
    appLanguage: "অ্যাপ ভাষা",
    quranTranslation: "কুরআন অনুবাদ",
    back: "পিছনে",
  },
  de: {
    home: "Start", quran: "Quran", hadith: "Hadith", search: "Suche", ai: "KI",
    settings: "Einstellungen", notifications: "Benachrichtigungen", progress: "Fortschritt",
    language: "Sprache", secondaryLanguage: "Zweite Übersetzung",
    none: "Keine", bookmarks: "Lesezeichen", bookmark: "Lesezeichen",
    share: "Teilen", play: "Abspielen", pause: "Pause", download: "Herunterladen",
    loadMore: "Mehr laden", noResults: "Keine Ergebnisse",
    searchPlaceholder: "Quran, Hadith suchen…",
    ayahOfDay: "Vers des Tages", streak: "7-Tage-Serie",
    askAnything: "Fragen Sie etwas über den Islam…",
    nooraiScholar: "NoorAI Scholar", duaFinder: "Dua-Finder",
    continueReading: "Weiterlesen", memorized: "Auswendig",
    needsReview: "Überprüfung nötig", notStarted: "Nicht begonnen",
    hifzProgress: "Hifz-Fortschritt", hifzMode: "Hifz-Modus",
    markMemorized: "Als auswendig markieren", tryAgain: "Erneut versuchen",
    verifyHadith: "Hadith prüfen", prayerTimes: "Gebetszeiten",
    enterCity: "Stadt eingeben", fetchingPrayer: "Laden…",
    savedBookmarks: "Gespeicherte Lesezeichen", noBookmarks: "Noch keine Lesezeichen",
    removeBookmark: "Entfernen", quranProgress: "Quran-Fortschritt",
    hadithProgress: "Hadith-Fortschritt", noorScore: "Noor-Punktzahl",
    badges: "Abzeichen", online: "Online — Bereit zu helfen",
    hadithLibrary: "Hadith-Bibliothek", allBooks: "Alle Bücher",
    loadMoreHadith: "Mehr Hadithe laden",
    selectLanguage: "Sprache wählen",
    appLanguage: "App-Sprache",
    quranTranslation: "Quran-Übersetzung",
    back: "Zurück",
  },
  es: {
    home: "Inicio", quran: "Corán", hadith: "Hadiz", search: "Buscar", ai: "IA",
    settings: "Ajustes", notifications: "Notificaciones", progress: "Progreso",
    language: "Idioma", secondaryLanguage: "Traducción secundaria",
    none: "Ninguna", bookmarks: "Marcadores", bookmark: "Marcador",
    share: "Compartir", play: "Reproducir", pause: "Pausa", download: "Descargar",
    loadMore: "Cargar más", noResults: "Sin resultados",
    searchPlaceholder: "Buscar Corán, Hadiz…",
    ayahOfDay: "Aleya del día", streak: "Racha de 7 días",
    askAnything: "Pregunta sobre el Islam…",
    nooraiScholar: "NoorAI Scholar", duaFinder: "Buscador de Dua",
    continueReading: "Seguir leyendo", memorized: "Memorizado",
    needsReview: "Necesita repaso", notStarted: "No iniciado",
    hifzProgress: "Progreso Hifz", hifzMode: "Modo Hifz",
    markMemorized: "Marcar memorizado", tryAgain: "Reintentar",
    verifyHadith: "Verificar Hadiz", prayerTimes: "Horarios de oración",
    enterCity: "Ingresa tu ciudad", fetchingPrayer: "Cargando…",
    savedBookmarks: "Marcadores guardados", noBookmarks: "Sin marcadores aún",
    removeBookmark: "Eliminar", quranProgress: "Progreso del Corán",
    hadithProgress: "Progreso Hadiz", noorScore: "Puntuación Noor",
    badges: "Insignias", online: "En línea — Listo para ayudar",
    hadithLibrary: "Biblioteca de Hadiz", allBooks: "Todos los libros",
    loadMoreHadith: "Cargar más Hadices",
    selectLanguage: "Seleccionar idioma",
    appLanguage: "Idioma de la app",
    quranTranslation: "Traducción del Corán",
    back: "Volver",
  },
  ru: {
    home: "Главная", quran: "Коран", hadith: "Хадис", search: "Поиск", ai: "ИИ",
    settings: "Настройки", notifications: "Уведомления", progress: "Прогресс",
    language: "Язык", secondaryLanguage: "Второй перевод",
    none: "Нет", bookmarks: "Закладки", bookmark: "Закладка",
    share: "Поделиться", play: "Воспроизвести", pause: "Пауза", download: "Скачать",
    loadMore: "Загрузить ещё", noResults: "Ничего не найдено",
    searchPlaceholder: "Поиск Корана, Хадисов…",
    ayahOfDay: "Аят дня", streak: "Серия 7 дней",
    askAnything: "Спросите что угодно об Исламе…",
    nooraiScholar: "NoorAI Scholar", duaFinder: "Поиск дуа",
    continueReading: "Продолжить чтение", memorized: "Заучено",
    needsReview: "Нужен повтор", notStarted: "Не начато",
    hifzProgress: "Прогресс хифз", hifzMode: "Режим хифз",
    markMemorized: "Отметить заученным", tryAgain: "Попробовать снова",
    verifyHadith: "Проверить хадис", prayerTimes: "Время намаза",
    enterCity: "Введите город", fetchingPrayer: "Загрузка…",
    savedBookmarks: "Сохранённые закладки", noBookmarks: "Закладок пока нет",
    removeBookmark: "Удалить", quranProgress: "Прогресс Корана",
    hadithProgress: "Прогресс хадисов", noorScore: "Счёт Нур",
    badges: "Значки", online: "Онлайн — Готов помочь",
    hadithLibrary: "Библиотека хадисов", allBooks: "Все книги",
    loadMoreHadith: "Загрузить ещё хадисы",
    selectLanguage: "Выберите язык",
    appLanguage: "Язык приложения",
    quranTranslation: "Перевод Корана",
    back: "Назад",
  },
  ur: {
    home: "ہوم", quran: "قرآن", hadith: "حدیث", search: "تلاش", ai: "اے آئی",
    settings: "ترتیبات", notifications: "اطلاعات", progress: "پیش رفت",
    language: "زبان", secondaryLanguage: "ثانوی ترجمہ",
    none: "کوئی نہیں", bookmarks: "بک مارکس", bookmark: "بک مارک",
    share: "شیئر", play: "چلائیں", pause: "روکیں", download: "ڈاؤنلوڈ",
    loadMore: "مزید لوڈ کریں", noResults: "کوئی نتیجہ نہیں",
    searchPlaceholder: "قرآن، حدیث تلاش کریں…",
    ayahOfDay: "آج کی آیت", streak: "7 دن کا سلسلہ",
    askAnything: "اسلام کے بارے میں کچھ بھی پوچھیں…",
    nooraiScholar: "NoorAI Scholar", duaFinder: "دعا تلاش",
    continueReading: "پڑھنا جاری رکھیں", memorized: "حفظ شدہ",
    needsReview: "مراجعت ضروری", notStarted: "شروع نہیں ہوا",
    hifzProgress: "حفظ کی پیش رفت", hifzMode: "حفظ موڈ",
    markMemorized: "حفظ شدہ نشان لگائیں", tryAgain: "دوبارہ کوشش کریں",
    verifyHadith: "حدیث کی تصدیق", prayerTimes: "نماز کے اوقات",
    enterCity: "اپنا شہر درج کریں", fetchingPrayer: "لوڈ ہو رہا ہے…",
    savedBookmarks: "محفوظ بک مارکس", noBookmarks: "ابھی تک کوئی بک مارک نہیں",
    removeBookmark: "ہٹائیں", quranProgress: "قرآن کی پیش رفت",
    hadithProgress: "حدیث کی پیش رفت", noorScore: "نور سکور",
    badges: "بیجز", online: "آن لائن — مدد کے لیے تیار",
    hadithLibrary: "حدیث لائبریری", allBooks: "تمام کتب",
    loadMoreHadith: "مزید احادیث لوڈ کریں",
    selectLanguage: "زبان منتخب کریں",
    appLanguage: "ایپ کی زبان",
    quranTranslation: "قرآن کا ترجمہ",
    back: "واپس",
  },
};

interface I18nContextType {
  lang: LangCode;
  secondaryLang: LangCode | null;
  setLang: (l: LangCode) => void;
  setSecondaryLang: (l: LangCode | null) => void;
  t: (key: string) => string;
  isRtl: boolean;
  quranEdition: string;
  secondaryQuranEdition: string | null;
  hadithPrefix: string;
  currentLanguage: Language;
}

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  secondaryLang: null,
  setLang: () => {},
  setSecondaryLang: () => {},
  t: (k) => k,
  isRtl: false,
  quranEdition: "en.asad",
  secondaryQuranEdition: null,
  hadithPrefix: "eng",
  currentLanguage: LANGUAGES[0],
});

export const useI18n = () => useContext(I18nContext);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<LangCode>(() => {
    return (localStorage.getItem("noorai_lang") as LangCode) || "en";
  });
  const [secondaryLang, setSecondaryLangState] = useState<LangCode | null>(() => {
    return localStorage.getItem("noorai_secondary_lang") as LangCode | null;
  });

  const currentLanguage = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];
  const secondaryLanguage = secondaryLang ? LANGUAGES.find(l => l.code === secondaryLang) : null;

  const setLang = (l: LangCode) => {
    setLangState(l);
    localStorage.setItem("noorai_lang", l);
    // Save to DB
    savePrefsToDB(l, secondaryLang);
  };

  const setSecondaryLang = (l: LangCode | null) => {
    setSecondaryLangState(l);
    if (l) localStorage.setItem("noorai_secondary_lang", l);
    else localStorage.removeItem("noorai_secondary_lang");
    savePrefsToDB(lang, l);
  };

  const savePrefsToDB = async (primary: LangCode, secondary: LangCode | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase.from("user_preferences") as any).upsert({
      user_id: user.id,
      language: primary,
      secondary_language: secondary,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  };

  // Load from DB on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase.from("user_preferences") as any).select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        if (data.language) { setLangState(data.language); localStorage.setItem("noorai_lang", data.language); }
        if (data.secondary_language) { setSecondaryLangState(data.secondary_language); localStorage.setItem("noorai_secondary_lang", data.secondary_language); }
      }
    })();
  }, []);

  // Apply RTL to document
  useEffect(() => {
    document.documentElement.dir = currentLanguage.rtl ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang, currentLanguage.rtl]);

  const t = (key: string): string => {
    return translations[lang]?.[key] || translations.en[key] || key;
  };

  return (
    <I18nContext.Provider value={{
      lang,
      secondaryLang,
      setLang,
      setSecondaryLang,
      t,
      isRtl: currentLanguage.rtl,
      quranEdition: currentLanguage.quranEdition,
      secondaryQuranEdition: secondaryLanguage?.quranEdition || null,
      hadithPrefix: currentLanguage.hadithPrefix,
      currentLanguage,
    }}>
      {children}
    </I18nContext.Provider>
  );
};
