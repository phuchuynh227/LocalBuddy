import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'en' | 'vn';

type TranslationParams = Record<string, string | number>;

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, params?: TranslationParams) => string;
};

const STORAGE_KEY = 'localbuddy_language';

const translations = {
  en: {
    common: {
      ok: 'OK',
      back: 'Back',
      home: 'Home',
    },
    tabs: {
      home: 'Home',
      explore: 'Explore',
      profile: 'Profile',
    },
    home: {
      subtitle: 'Find people with the same plans',
      planTitle: "What's your plan today?",
      planSubtitle: "Share your vibe and we'll find your buddy.",
      createPlan: 'Create a plan',
      findBuddy: 'Find a buddy',
      map: 'Map',
      browseTitle: 'Browse by activity',
      browseSubtitle: 'Pick a category to get started',
    },
    categories: {
      cafe: 'Cafe',
      gym: 'Gym',
      movies: 'Movies',
      park: 'Park',
      food: 'Food',
      study: 'Study',
    },
    places: {
      backToHome: 'Back to Home',
      reviewsCount: '{{count}} reviews',
      empty: 'No places found',
    },
    placeDetail: {
      notFound: 'Place not found',
      description: 'Description',
      viewMap: 'View map',
      save: 'Save',
      writeReview: 'Write a review',
      reviewsCount: '{{count}} reviews',
      createPlan: 'Create a plan here',
    },
    explore: {
      title: 'Explore',
      subtitle: 'Find places in Da Nang',
      searchPlaceholder: 'Search name, address, description...',
      results: '{{count}} places{{suffix}}',
      resultsSuffixForQuery: ' for "{{query}}"',
      empty: 'No places found',
    },
    profile: {
      memberSince: 'Member since {{date}}',
      activity: 'Activity',
      savedPlaces: 'Saved places',
      myReviews: 'My reviews',
      settings: 'Settings',
      notifications: 'Notifications',
      changePassword: 'Change password',
      logout: 'Log out',
      myMatches: 'My matches',
    },
    myReviews: {
      title: 'My reviews',
      loading: 'Loading your reviews...',
      empty: "You haven't written any reviews yet.",
      unknownPlace: 'Unknown place',
    },
    myPlans: {
      title: 'My plans',
      open: 'Open',
      full: 'Full',
      cancelled: 'Cancelled',
      buddySlots: 'Buddies',
      pending: 'Pending',
      totalRequests: 'Total requests',
      requests: 'Requests',
      accepted: 'Accepted',
      declined: 'Declined',
      accept: 'Accept',
      decline: 'Decline',
      chat: 'Message',
      cancelPlan: 'Cancel plan',
      cancelConfirm: 'Cancel this plan?',
      cancelConfirmMsg: 'Are you sure you want to cancel?',
      declineConfirm: 'Decline request?',
      declineConfirmMsg: 'Are you sure?',
      empty: 'No plans yet',
      emptySubtitle: 'Create your first plan to find a buddy!',
      createPlan: 'Create plan',
      fullAlert: 'Plan is already full!',
    },
    myMatchesEn: {
      empty: 'No matches yet',
      emptySubtitle: 'Create a plan or join someone else to find a buddy.',
      pendingSection: 'Waiting for confirmation ({{count}})',
      matchedSection: 'Matched ({{count}})',
      pendingBadge: 'Pending',
      matchedBadge: 'Matched',
      yourBuddy: 'Your buddy',
      chatWithBuddy: 'Message buddy',
      fallbackPlan: 'Plan',
    },
    myMatches: {
      empty: 'ChÆ°a cÃ³ match nÃ o',
      emptySubtitle: 'Táº¡o plan hoáº·c tham gia plan cá»§a ngÆ°á»i khÃ¡c Ä‘á»ƒ tÃ¬m buddy.',
      pendingSection: 'Äang chá» xÃ¡c nháº­n ({{count}})',
      matchedSection: 'ÄÃ£ match ({{count}})',
      pendingBadge: 'Chá» duyá»‡t',
      matchedBadge: 'ÄÃ£ match',
      yourBuddy: 'Buddy cá»§a báº¡n',
      chatWithBuddy: 'Nháº¯n tin vá»›i buddy',
      fallbackPlan: 'Plan',
    },
    forgotPassword: {
      title: 'Forgot Password?',
      subtitle: "Enter your registered email, we'll send a reset link.",
      emailPlaceholder: 'Email',
      sendButton: 'Send Reset Link',
      sending: 'Sending...',
      successTitle: 'Email Sent!',
      successSubtitle:
        'Check your inbox and follow the instructions to reset your password.',
      backToLogin: 'Back to Login',
      back: '← Back',
      emailRequired: 'Please enter your email',
      link: 'Forgot password?',
    },
    changePassword: {
      title: 'Change Password',
      subtitle: 'Enter a new password for your account.',
      newPassword: 'New Password',
      confirmPassword: 'Confirm New Password',
      updateButton: 'Update Password',
      updating: 'Updating...',
      successSubtitle: 'Your password has been changed!',
    },
    createPlan: {
      title: 'Find a buddy',
      whatToDo: 'What do you want to do?',
      when: 'When?',
      date: 'Date',
      selectDate: 'Select a date',
      datePlaceholder: 'E.g. 20/03/2026',
      time: 'Time',
      timeOptional: '(optional)',
      anyTime: 'Any time',
      findButton: 'Find buddy',
      searching: 'Searching...',
      foundPlans: '{{count}} matching plans',
      noPlans: 'No matching plans found',
      spotsLeft: '{{count}} spots',
      full: 'Full',
      join: 'Want to join',
      joining: 'Sending...',
      createOwn: 'Create my own plan',
      modalTitle: 'Create my plan',
      planTitleLabel: 'Title *',
      planTitlePlaceholder: 'E.g. Morning coffee',
      area: 'Area *',
      areaPlaceholder: 'E.g. Hai Chau, My An...',
      descriptionLabel: 'Description (optional)',
      descriptionPlaceholder: 'Add more info about your plan...',
      maxBuddies: 'Max buddies',
      publish: 'Post plan',
      publishing: 'Posting...',
      errorCategory: 'Please select an activity',
      errorDate: 'Please enter a date',
      errorTitle: 'Please enter a title',
      errorArea: 'Please enter an area',
      errorInvalidDate: 'Invalid date format',
      requestSent: 'Request sent!',
      waitForHost: 'Waiting for host to confirm!',
      planCreated: 'Plan created!',
      waitForBuddy: 'Waiting for buddies to find you!',
      alreadyRequested: 'You already sent a request!',
      fullAlert: 'This plan is full!',
      errorRequest: 'Could not send request, please try again.',
      errorCreate: 'Could not create plan, please try again.',
      reasonActivity: 'Same activity',
      reasonDate: 'Same day',
      reasonTimeExact: 'Same time',
      reasonTimeNear: 'Similar time',
    },
    writeReview: {
      title: 'Write a review',
      place: 'Place',
      yourRating: 'Your rating',
      notSelected: 'Not selected',
      ratingBad: 'Bad',
      ratingNotGood: 'Not good',
      ratingOkay: 'Okay',
      ratingGood: 'Good',
      ratingExcellent: 'Excellent!',
      comment: 'Comment',
      commentPlaceholder: 'Share your experience about this place...',
      chars: '{{count}} characters',
      sending: 'Sending...',
      submit: '✅ Submit review',
      errorTitle: 'Error',
      pickStars: 'Please choose a star rating',
      enterComment: 'Please enter a comment',
      submitFailed: 'Could not submit review, please try again.',
      successTitle: 'Success!',
      thanks: 'Thanks for your review!',
    },
    map: {
      title: 'Da Nang map',
      count: '{{count}} places',
      viewDetail: 'View details →',
    },
    auth: {
      loginTitle: 'Local Buddy',
      loginSubtitle: 'Discover places around you',
      email: 'Email',
      password: 'Password',
      login: 'Log in',
      loggingIn: 'Logging in...',
      loginFailed: 'Login failed',
      missingEmailPassword: 'Please enter email and password',
      noAccount: "Don't have an account? ",
      registerNow: 'Register now',
      registerTitle: 'Create account',
      registerSubtitle: 'Join Local Buddy today',
      confirmPassword: 'Confirm password',
      registering: 'Creating account...',
      register: 'Register',
      haveAccount: 'Already have an account? ',
      signIn: 'Sign in',
      missingInfo: 'Please fill in all fields',
      passwordMismatch: 'Passwords do not match',
      passwordTooShort: 'Password must be at least 6 characters',
      registerFailed: 'Registration failed',
      accountCreatedTitle: 'Success!',
      accountCreated: 'Your account has been created!',
    },
  },
  vn: {
    common: {
      ok: 'OK',
      back: 'Quay lại',
      home: 'Trang chủ',
    },
    tabs: {
      home: 'Trang chủ',
      explore: 'Khám phá',
      profile: 'Cá nhân',
    },
    home: {
      subtitle: 'Kết nối người có cùng kế hoạch',
      planTitle: 'Hôm nay bạn định làm gì?',
      planSubtitle: 'Chia sẻ kế hoạch và tìm bạn đồng hành.',
      createPlan: 'Tạo kế hoạch',
      findBuddy: 'Tìm buddy',
      map: 'Bản đồ',
      browseTitle: 'Chọn hoạt động',
      browseSubtitle: 'Chọn một danh mục để bắt đầu',
    },
    categories: {
      cafe: 'Cà phê',
      gym: 'Gym',
      movies: 'Xem phim',
      park: 'Công viên',
      food: 'Ăn uống',
      study: 'Học tập',
    },
    places: {
      backToHome: 'Về trang chủ',
      reviewsCount: '{{count}} đánh giá',
      empty: 'Không có địa điểm nào',
    },
    placeDetail: {
      notFound: 'Không tìm thấy địa điểm',
      description: 'Mô tả',
      viewMap: 'Xem bản đồ',
      save: 'Lưu lại',
      writeReview: 'Viết đánh giá',
      reviewsCount: '{{count}} đánh giá',
      createPlan: 'Tạo kế hoạch tại đây',
    },
    explore: {
      title: 'Khám phá',
      subtitle: 'Tìm địa điểm tại Đà Nẵng',
      searchPlaceholder: 'Tìm tên, địa chỉ, mô tả...',
      results: '{{count}} địa điểm{{suffix}}',
      resultsSuffixForQuery: ' cho "{{query}}"',
      empty: 'Không tìm thấy địa điểm nào',
    },
    profile: {
      memberSince: 'Thành viên từ {{date}}',
      activity: 'Hoạt động',
      savedPlaces: 'Địa điểm đã lưu',
      myReviews: 'Đánh giá của tôi',
      settings: 'Cài đặt',
      notifications: 'Thông báo',
      changePassword: 'Đổi mật khẩu',
      logout: 'Đăng xuất',
      myMatches: 'Matches của tôi',
    },
    myReviews: {
      title: 'Đánh giá của tôi',
      loading: 'Đang tải đánh giá...',
      empty: 'Bạn chưa viết đánh giá nào.',
      unknownPlace: 'Địa điểm không xác định',
    },
    myPlans: {
      title: 'Kế hoạch của tôi',
      open: 'Đang mở',
      full: 'Đã đầy',
      cancelled: 'Đã huỷ',
      buddySlots: 'Buddy',
      pending: 'Đang chờ',
      totalRequests: 'Tổng số yêu cầu',
      requests: 'Yêu cầu',
      accepted: 'Đã chấp nhận',
      declined: 'Đã từ chối',
      accept: 'Chấp nhận',
      decline: 'Từ chối',
      chat: 'Nhắn tin',
      cancelPlan: 'Huỷ plan',
      cancelConfirm: 'Huỷ plan này?',
      cancelConfirmMsg: 'Bạn chắc chắn muốn huỷ plan?',
      declineConfirm: 'Từ chối yêu cầu?',
      declineConfirmMsg: 'Bạn chắc chắn chứ?',
      empty: 'Chưa có plan nào',
      emptySubtitle: 'Tạo plan đầu tiên để tìm buddy nhé!',
      createPlan: 'Tạo plan',
      fullAlert: 'Plan đã đầy rồi!',
    },
    forgotPassword: {
      title: 'Quên mật khẩu?',
      subtitle: 'Nhập email đăng ký của bạn, chúng tôi sẽ gửi link đặt lại mật khẩu.',
      emailPlaceholder: 'Email',
      sendButton: 'Gửi link đặt lại',
      sending: 'Đang gửi...',
      successTitle: 'Đã gửi email!',
      successSubtitle:
        'Kiểm tra hộp thư của {{email}} và làm theo hướng dẫn để đặt lại mật khẩu.',
      backToLogin: 'Quay lại đăng nhập',
      back: '← Quay lại',
      emailRequired: 'Vui lòng nhập email',
      link: 'Quên mật khẩu?',
    },
    changePassword: {
      title: 'Đổi mật khẩu',
      subtitle: 'Nhập mật khẩu mới cho tài khoản của bạn.',
      newPassword: 'Mật khẩu mới',
      confirmPassword: 'Xác nhận mật khẩu mới',
      updateButton: 'Cập nhật mật khẩu',
      updating: 'Đang cập nhật...',
      successSubtitle: 'Mật khẩu đã được thay đổi!',
    },
    createPlan: {
      title: 'Tìm buddy',
      whatToDo: 'Bạn muốn làm gì?',
      when: 'Khi nào?',
      date: 'Ngày',
      selectDate: 'Chọn ngày',
      datePlaceholder: 'VD: 20/03/2026',
      time: 'Giờ',
      timeOptional: '(tuỳ chọn)',
      anyTime: 'Bất kỳ',
      findButton: 'Tìm buddy',
      searching: 'Đang tìm...',
      foundPlans: '{{count}} plan phù hợp',
      noPlans: 'Chưa có plan nào phù hợp',
      spotsLeft: '{{count}} chỗ',
      full: 'Đầy',
      join: 'Muốn tham gia',
      joining: 'Đang gửi...',
      createOwn: 'Tạo plan của tôi',
      modalTitle: 'Tạo plan của tôi',
      planTitleLabel: 'Tiêu đề *',
      planTitlePlaceholder: 'VD: Cafe sáng cuối tuần',
      area: 'Khu vực *',
      areaPlaceholder: 'VD: Hải Châu, Mỹ An...',
      descriptionLabel: 'Mô tả (tuỳ chọn)',
      descriptionPlaceholder: 'Thêm thông tin về plan...',
      maxBuddies: 'Số buddy tối đa',
      publish: '🚀 Đăng plan',
      publishing: 'Đang tạo...',
      errorCategory: 'Vui lòng chọn hoạt động',
      errorDate: 'Vui lòng nhập ngày',
      errorTitle: 'Vui lòng nhập tiêu đề',
      errorArea: 'Vui lòng nhập khu vực',
      errorInvalidDate: 'Sai định dạng ngày',
      requestSent: 'Đã gửi! 🎉',
      waitForHost: 'Chờ host xác nhận nhé!',
      planCreated: 'Plan đã được tạo! 🚀',
      waitForBuddy: 'Chờ buddy tìm thấy bạn nhé!',
      alreadyRequested: 'Bạn đã gửi request rồi!',
      fullAlert: 'Plan này đã đầy buddy rồi!',
      errorRequest: 'Không thể gửi, thử lại nhé!',
      errorCreate: 'Không thể tạo plan, thử lại nhé!',
      reasonActivity: 'Cùng hoạt động',
      reasonDate: 'Cùng ngày',
      reasonTimeExact: 'Cùng giờ',
      reasonTimeNear: 'Gần giờ',
    },
    writeReview: {
      title: 'Viết đánh giá',
      place: 'Địa điểm',
      yourRating: 'Đánh giá của bạn',
      notSelected: 'Chưa chọn',
      ratingBad: 'Tệ',
      ratingNotGood: 'Không tốt',
      ratingOkay: 'Bình thường',
      ratingGood: 'Tốt',
      ratingExcellent: 'Xuất sắc!',
      comment: 'Nhận xét',
      commentPlaceholder: 'Chia sẻ trải nghiệm của bạn về địa điểm này...',
      chars: '{{count}} ký tự',
      sending: 'Đang gửi...',
      submit: '✅ Gửi đánh giá',
      errorTitle: 'Lỗi',
      pickStars: 'Vui lòng chọn số sao đánh giá',
      enterComment: 'Vui lòng nhập nhận xét',
      submitFailed: 'Không thể gửi đánh giá, thử lại nhé!',
      successTitle: 'Thành công!',
      thanks: 'Cảm ơn bạn đã đánh giá!',
    },
    map: {
      title: 'Bản đồ Đà Nẵng',
      count: '{{count}} địa điểm',
      viewDetail: 'Xem chi tiết →',
    },
    auth: {
      loginTitle: 'Local Buddy',
      loginSubtitle: 'Khám phá địa điểm xung quanh bạn',
      email: 'Email',
      password: 'Mật khẩu',
      login: 'Đăng nhập',
      loggingIn: 'Đang đăng nhập...',
      loginFailed: 'Đăng nhập thất bại',
      missingEmailPassword: 'Vui lòng nhập email và mật khẩu',
      noAccount: 'Chưa có tài khoản? ',
      registerNow: 'Đăng ký ngay',
      registerTitle: 'Tạo tài khoản',
      registerSubtitle: 'Tham gia Local Buddy hôm nay',
      confirmPassword: 'Xác nhận mật khẩu',
      registering: 'Đang tạo tài khoản...',
      register: 'Đăng ký',
      haveAccount: 'Đã có tài khoản? ',
      signIn: 'Đăng nhập',
      missingInfo: 'Vui lòng điền đầy đủ thông tin',
      passwordMismatch: 'Mật khẩu xác nhận không khớp',
      passwordTooShort: 'Mật khẩu phải có ít nhất 6 ký tự',
      registerFailed: 'Đăng ký thất bại',
      accountCreatedTitle: 'Thành công!',
      accountCreated: 'Tài khoản đã được tạo!',
    },
  },
} as const;

function interpolate(template: string, params?: TranslationParams) {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? `{{${key}}}`));
}

function getNested(obj: any, path: string) {
  return path.split('.').reduce((acc, part) => (acc && acc[part] != null ? acc[part] : undefined), obj);
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!alive) return;
        if (stored === 'en' || stored === 'vn') setLanguageState(stored);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'vn' : 'en');
  }, [language, setLanguage]);

  const t = useCallback(
    (key: string, params?: TranslationParams) => {
      const value =
        getNested(translations[language], key) ??
        getNested(translations.en, key) ??
        key;
      if (typeof value !== 'string') return key;
      return interpolate(value, params);
    },
    [language],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, toggleLanguage, t }),
    [language, setLanguage, toggleLanguage, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

