import { Lang } from '@/types/lang';

// 翻译文件类型定义
export interface Translations {
  // 通用
  common: {
    login: string;
    logout: string;
    register: string;
    cancel: string;
    confirm: string;
    submit: string;
    save: string;
    delete: string;
    edit: string;
    back: string;
    next: string;
    loading: string;
    error: string;
    success: string;
    confirm_logout: string;
    confirm_logout_desc: string;
    logged_in: string;
    enter_admin: string;
    language: string;
  };
  
  // 导航
  nav: {
    home: string;
    cloze: string;
    alignment_practice: string;
    wide_reading: string;
    shadowing: string;
    vocabulary: string;
    admin: string;
  };
  
  // 练习相关
  practice: {
    start_practice: string;
    submit_answer: string;
    check_answer: string;
    next_question: string;
    score: string;
    difficulty: string;
    topic: string;
    generate: string;
    no_items: string;
    practice_complete: string;
  };
  
  // 管理员面板
  admin: {
    dashboard: string;
    articles: string;
    drafts: string;
    alignment_packs: string;
    cloze_items: string;
    shadowing_items: string;
    vocabulary_banks: string;
    ai_generation: string;
    batch_generation: string;
    settings: string;
  };
  
  // 表单标签
  form: {
    title: string;
    content: string;
    tags: string;
    source: string;
    license: string;
    provider: string;
    model: string;
    temperature: string;
    max_tokens: string;
    email: string;
    password: string;
    password_min: string;
  };
  
  // 认证页面
  auth: {
    login_title: string;
    email_password: string;
    google_login: string;
    use_google_login: string;
    signup_success: string;
    signup_success_email: string;
    login_failed: string;
    signup_failed: string;
    google_login_failed: string;
  };
  
  // Shadowing 练习
  shadowing: {
    title: string;
    real_speech_recognition: string;
    difficulty_level: string;
    recommended: string;
    recommend_level: string;
    need_more_content: string;
    ai_generate_bank: string;
    ai_generate_desc: string;
    get_next_question: string;
    loading: string;
    change_question: string;
    vocab_mode_on: string;
    vocab_mode_off: string;
    vocab_mode_desc_on: string;
    vocab_mode_desc_off: string;
    original_audio: string;
    follow_recording: string;
    start_recording: string;
    stop_recording: string;
    recognizing_speech: string;
    recognition_result: string;
    your_recording: string;
    start_scoring: string;
    scoring: string;
    word_by_word_comparison: string;
    original_text: string;
    recognized: string;
    accuracy: string;
    score_excellent: string;
    score_good: string;
    score_average: string;
    score_pass: string;
    score_needs_improvement: string;
    selected_words: string;
    clear: string;
    import_to_vocab: string;
    importing: string;
    remove: string;
    import_success: string;
    import_failed: string;
    levels: {
      l1: string;
      l2: string;
      l3: string;
      l4: string;
      l5: string;
    };
  };
}

// 中文翻译
const zh: Translations = {
  common: {
    login: '登录',
    logout: '登出',
    register: '注册',
    cancel: '取消',
    confirm: '确定',
    submit: '提交',
    save: '保存',
    delete: '删除',
    edit: '编辑',
    back: '返回',
    next: '下一步',
    loading: '加载中...',
    error: '错误',
    success: '成功',
    confirm_logout: '确认登出',
    confirm_logout_desc: '你将退出当前账号，是否继续？',
    logged_in: '已登录',
    enter_admin: '进入后台',
    language: '语言',
  },
  nav: {
    home: '首页',
    cloze: '完形填空',
    alignment_practice: '对齐练习',
    wide_reading: '广读',
    shadowing: '跟读练习',
    vocabulary: '生词本',
    admin: '管理员',
  },
  practice: {
    start_practice: '开始练习',
    submit_answer: '提交答案',
    check_answer: '检查答案',
    next_question: '下一题',
    score: '得分',
    difficulty: '难度',
    topic: '主题',
    generate: '生成',
    no_items: '暂无练习项目',
    practice_complete: '练习完成',
  },
  admin: {
    dashboard: '控制台',
    articles: '文章管理',
    drafts: '草稿管理',
    alignment_packs: '对齐训练包',
    cloze_items: '完形填空题',
    shadowing_items: '跟读素材',
    vocabulary_banks: '词汇库',
    ai_generation: 'AI 生成',
    batch_generation: '批量生成',
    settings: '设置',
  },
  form: {
    title: '标题',
    content: '内容',
    tags: '标签',
    source: '来源',
    license: '许可',
    provider: '提供商',
    model: '模型',
    temperature: '温度',
    max_tokens: '最大令牌数',
    email: '邮箱',
    password: '密码',
    password_min: '密码（≥6位）',
  },
  auth: {
    login_title: '登录到 Lang Trainer',
    email_password: '邮箱 + 密码',
    google_login: '使用 Google 登录',
    use_google_login: '用 Google 登录',
    signup_success: '注册成功',
    signup_success_email: '注册成功。如启用邮箱验证，请前往邮箱完成确认。',
    login_failed: '登录失败',
    signup_failed: '注册失败',
    google_login_failed: 'Google 登录启动失败',
  },
  shadowing: {
    title: 'Shadowing 跟读练习',
    real_speech_recognition: '（真实语音识别）',
    difficulty_level: '难度等级：',
    recommended: '推荐',
    recommend_level: '建议选择 L{level} 等级进行练习',
    need_more_content: '需要更多练习内容？',
    ai_generate_bank: '🤖 AI 生成题库',
    ai_generate_desc: '使用 AI 生成更多适合你当前等级的练习内容',
    get_next_question: '获取下一题',
    loading: '加载中...',
    change_question: '换一题',
    vocab_mode_on: '退出选词模式',
    vocab_mode_off: '开启选词模式',
    vocab_mode_desc_on: '点击或拖拽选择生词',
    vocab_mode_desc_off: '点击开启生词选择功能',
    original_audio: '原音频：',
    follow_recording: '跟读录音：',
    start_recording: '开始录音',
    stop_recording: '停止录音',
    recognizing_speech: '正在识别语音...',
    recognition_result: '🎤 语音识别结果：',
    your_recording: '你的录音：',
    start_scoring: '开始评分',
    scoring: '评分中...',
    word_by_word_comparison: '🔤 逐句逐字比对（识别不含标点）',
    original_text: '原文',
    recognized: '识别',
    accuracy: '准确度：',
    score_excellent: '优秀',
    score_good: '良好',
    score_average: '中等',
    score_pass: '及格',
    score_needs_improvement: '需改进',
    selected_words: '本次选中的生词',
    clear: '清空',
    import_to_vocab: '导入到生词本',
    importing: '导入中...',
    remove: '移除',
    import_success: '成功导入 {count} 个生词到生词本！',
    import_failed: '导入失败：{error}',
    levels: {
      l1: 'L1 - 初级',
      l2: 'L2 - 初中级',
      l3: 'L3 - 中级',
      l4: 'L4 - 中高级',
      l5: 'L5 - 高级',
    },
  },
};

// 英文翻译
const en: Translations = {
  common: {
    login: 'Login',
    logout: 'Logout',
    register: 'Register',
    cancel: 'Cancel',
    confirm: 'Confirm',
    submit: 'Submit',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    back: 'Back',
    next: 'Next',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    confirm_logout: 'Confirm Logout',
    confirm_logout_desc: 'You will be logged out of your current account. Continue?',
    logged_in: 'Logged In',
    enter_admin: 'Enter Admin',
    language: 'Language',
  },
  nav: {
    home: 'Home',
    cloze: 'Cloze',
    alignment_practice: 'Alignment Practice',
    wide_reading: 'Wide Reading',
    shadowing: 'Shadowing',
    vocabulary: 'Vocabulary',
    admin: 'Admin',
  },
  practice: {
    start_practice: 'Start Practice',
    submit_answer: 'Submit Answer',
    check_answer: 'Check Answer',
    next_question: 'Next Question',
    score: 'Score',
    difficulty: 'Difficulty',
    topic: 'Topic',
    generate: 'Generate',
    no_items: 'No practice items available',
    practice_complete: 'Practice Complete',
  },
  admin: {
    dashboard: 'Dashboard',
    articles: 'Articles',
    drafts: 'Drafts',
    alignment_packs: 'Alignment Packs',
    cloze_items: 'Cloze Items',
    shadowing_items: 'Shadowing Items',
    vocabulary_banks: 'Vocabulary Banks',
    ai_generation: 'AI Generation',
    batch_generation: 'Batch Generation',
    settings: 'Settings',
  },
  form: {
    title: 'Title',
    content: 'Content',
    tags: 'Tags',
    source: 'Source',
    license: 'License',
    provider: 'Provider',
    model: 'Model',
    temperature: 'Temperature',
    max_tokens: 'Max Tokens',
    email: 'Email',
    password: 'Password',
    password_min: 'Password (6+ characters)',
  },
  auth: {
    login_title: 'Login to Lang Trainer',
    email_password: 'Email + Password',
    google_login: 'Login with Google',
    use_google_login: 'Login with Google',
    signup_success: 'Registration successful',
    signup_success_email: 'Registration successful. If email verification is enabled, please check your email to complete confirmation.',
    login_failed: 'Login failed',
    signup_failed: 'Registration failed',
    google_login_failed: 'Google login initiation failed',
  },
  shadowing: {
    title: 'Shadowing Practice',
    real_speech_recognition: '(Real Speech Recognition)',
    difficulty_level: 'Difficulty Level:',
    recommended: 'Recommended',
    recommend_level: 'Recommend choosing L{level} for practice',
    need_more_content: 'Need more practice content?',
    ai_generate_bank: '🤖 AI Generate Bank',
    ai_generate_desc: 'Use AI to generate more practice content suitable for your current level',
    get_next_question: 'Get Next Question',
    loading: 'Loading...',
    change_question: 'Change Question',
    vocab_mode_on: 'Exit Word Selection Mode',
    vocab_mode_off: 'Enable Word Selection Mode',
    vocab_mode_desc_on: 'Click or drag to select vocabulary',
    vocab_mode_desc_off: 'Click to enable vocabulary selection feature',
    original_audio: 'Original Audio:',
    follow_recording: 'Follow Recording:',
    start_recording: 'Start Recording',
    stop_recording: 'Stop Recording',
    recognizing_speech: 'Recognizing speech...',
    recognition_result: '🎤 Speech Recognition Result:',
    your_recording: 'Your Recording:',
    start_scoring: 'Start Scoring',
    scoring: 'Scoring...',
    word_by_word_comparison: '🔤 Word-by-Word Comparison (Recognition without punctuation)',
    original_text: 'Original',
    recognized: 'Recognized',
    accuracy: 'Accuracy:',
    score_excellent: 'Excellent',
    score_good: 'Good',
    score_average: 'Average',
    score_pass: 'Pass',
    score_needs_improvement: 'Needs Improvement',
    selected_words: 'Selected Words This Time',
    clear: 'Clear',
    import_to_vocab: 'Import to Vocabulary',
    importing: 'Importing...',
    remove: 'Remove',
    import_success: 'Successfully imported {count} words to vocabulary!',
    import_failed: 'Import failed: {error}',
    levels: {
      l1: 'L1 - Beginner',
      l2: 'L2 - Elementary',
      l3: 'L3 - Intermediate',
      l4: 'L4 - Upper-Intermediate',
      l5: 'L5 - Advanced',
    },
  },
};

// 日文翻译
const ja: Translations = {
  common: {
    login: 'ログイン',
    logout: 'ログアウト',
    register: '登録',
    cancel: 'キャンセル',
    confirm: '確認',
    submit: '送信',
    save: '保存',
    delete: '削除',
    edit: '編集',
    back: '戻る',
    next: '次へ',
    loading: '読み込み中...',
    error: 'エラー',
    success: '成功',
    confirm_logout: 'ログアウト確認',
    confirm_logout_desc: '現在のアカウントからログアウトします。続行しますか？',
    logged_in: 'ログイン済み',
    enter_admin: '管理画面へ',
    language: '言語',
  },
  nav: {
    home: 'ホーム',
    cloze: '穴埋め問題',
    alignment_practice: 'アライメント練習',
    wide_reading: '多読',
    shadowing: 'シャドーイング',
    vocabulary: '単語帳',
    admin: '管理者',
  },
  practice: {
    start_practice: '練習開始',
    submit_answer: '答えを送信',
    check_answer: '答えを確認',
    next_question: '次の問題',
    score: 'スコア',
    difficulty: '難易度',
    topic: 'トピック',
    generate: '生成',
    no_items: '練習項目がありません',
    practice_complete: '練習完了',
  },
  admin: {
    dashboard: 'ダッシュボード',
    articles: '記事管理',
    drafts: '下書き管理',
    alignment_packs: 'アライメントパック',
    cloze_items: '穴埋め問題',
    shadowing_items: 'シャドーイング素材',
    vocabulary_banks: '語彙バンク',
    ai_generation: 'AI生成',
    batch_generation: '一括生成',
    settings: '設定',
  },
  form: {
    title: 'タイトル',
    content: '内容',
    tags: 'タグ',
    source: 'ソース',
    license: 'ライセンス',
    provider: 'プロバイダー',
    model: 'モデル',
    temperature: '温度',
    max_tokens: '最大トークン数',
    email: 'メール',
    password: 'パスワード',
    password_min: 'パスワード（6文字以上）',
  },
  auth: {
    login_title: 'Lang Trainerにログイン',
    email_password: 'メール + パスワード',
    google_login: 'Googleでログイン',
    use_google_login: 'Googleでログイン',
    signup_success: '登録成功',
    signup_success_email: '登録が完了しました。メール認証が有効な場合は、メールで確認を完了してください。',
    login_failed: 'ログイン失敗',
    signup_failed: '登録失敗',
    google_login_failed: 'Googleログインの開始に失敗しました',
  },
  shadowing: {
    title: 'シャドーイング練習',
    real_speech_recognition: '（実音声認識）',
    difficulty_level: '難易度レベル：',
    recommended: '推奨',
    recommend_level: 'L{level}レベルでの練習をお勧めします',
    need_more_content: 'より多くの練習コンテンツが必要ですか？',
    ai_generate_bank: '🤖 AI生成バンク',
    ai_generate_desc: 'AIを使用して現在のレベルに適した練習コンテンツを生成',
    get_next_question: '次の問題を取得',
    loading: '読み込み中...',
    change_question: '問題を変更',
    vocab_mode_on: '単語選択モードを終了',
    vocab_mode_off: '単語選択モードを有効化',
    vocab_mode_desc_on: 'クリックまたはドラッグして単語を選択',
    vocab_mode_desc_off: 'クリックして単語選択機能を有効化',
    original_audio: '元の音声：',
    follow_recording: 'フォロー録音：',
    start_recording: '録音開始',
    stop_recording: '録音停止',
    recognizing_speech: '音声を認識中...',
    recognition_result: '🎤 音声認識結果：',
    your_recording: 'あなたの録音：',
    start_scoring: 'スコア開始',
    scoring: 'スコア中...',
    word_by_word_comparison: '🔤 文章ごと単語比較（認識では句読点なし）',
    original_text: '原文',
    recognized: '認識',
    accuracy: '精度：',
    score_excellent: '優秀',
    score_good: '良好',
    score_average: '平均',
    score_pass: '合格',
    score_needs_improvement: '改善が必要',
    selected_words: '今回選択した単語',
    clear: 'クリア',
    import_to_vocab: '単語帳にインポート',
    importing: 'インポート中...',
    remove: '削除',
    import_success: '{count}個の単語を単語帳にインポートしました！',
    import_failed: 'インポート失敗：{error}',
    levels: {
      l1: 'L1 - 初級',
      l2: 'L2 - 初中級',
      l3: 'L3 - 中級',
      l4: 'L4 - 中上級',
      l5: 'L5 - 上級',
    },
  },
};

// 翻译字典
export const translations: Record<Lang, Translations> = {
  zh,
  en,
  ja,
};

// 语言显示名称
export const languageNames: Record<Lang, Record<Lang, string>> = {
  zh: { zh: '中文', en: 'English', ja: '日本語' },
  en: { zh: 'Chinese', en: 'English', ja: 'Japanese' },
  ja: { zh: '中国語', en: '英語', ja: '日本語' },
};
