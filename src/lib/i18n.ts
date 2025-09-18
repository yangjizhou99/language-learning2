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
    checking_login: string;
    login_required: string;
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
    click_words_to_select: string;
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
    // 新增的翻译内容
    filter: string;
    language: string;
    level: string;
    all_levels: string;
    practice_status: string;
    all_status: string;
    practiced: string;
    unpracticed: string;
    genre: string;
    all_genres: string;
    dialogue: string;
    monologue: string;
    news: string;
    lecture: string;
    major_theme: string;
    all_major_themes: string;
    minor_theme: string;
    all_minor_themes: string;
    select_major_theme_first: string;
    search: string;
    search_placeholder: string;
    random: string;
    next_question: string;
    total_questions: string;
    completed: string;
    draft: string;
    not_started: string;
    play_audio: string;
    save_draft: string;
    complete_and_save: string;
    debug_vocab: string;
    vocab_selection_mode: string;
    original_audio_text: string;
    translation: string;
    show_translation: string;
    recording_practice: string;
    recordings_count: string;
    no_recordings: string;
    start_recording_text: string;
    practice_scoring: string;
    // 新增的按钮和界面文本翻译
    refresh_vocabulary: string;
    select_question_to_start: string;
    click_vocabulary_button: string;
    select_from_left_vocabulary: string;
    shadowing_practice: string;
    shadowing_vocabulary: string;
    no_questions_found: string;
    // 生词解释相关
    no_explanation: string;
    explanation: string;
    part_of_speech: string;
    example_sentence: string;
    // 登录相关
    login_required_message: string;
    // 题目信息相关
    words: string;
    // 评分相关
    recording_completed: string;
    recording_completed_message: string;
    scoring_in_progress: string;
    scoring_result: string;
    no_recording_yet: string;
    complete_recording_first: string;
    re_score: string;
    re_scoring_in_progress: string;
    detailed_analysis: string;
    sentence: string;
    issues: string;
    analysis_based_on_sentence_level: string;
    overall_score: string;
    pronunciation_accuracy: string;
    improvement_suggestions: string;
    practice_comparison: string;
    your_pronunciation: string;
    levels: {
      l1: string;
      l2: string;
      l3: string;
      l4: string;
      l5: string;
    };
    // 保存弹窗
    saving_modal_title: string;
    saving_modal_description: string;
    // 功能说明
    functionality_guide: string;
  };

  // 词汇页面
  vocabulary: {
    title: string;
    total_vocab: string;
    filters: {
      language: string;
      all_languages: string;
      english: string;
      japanese: string;
      chinese: string;
      status: string;
      all_status: string;
      new_word: string;
      starred: string;
      archived: string;
      explanation_status: string;
      all_explanations: string;
      has_explanation: string;
      missing_explanation: string;
      search: string;
      search_placeholder: string;
      reset: string;
      speech_rate: string;
    };
    ai_generation: {
      title: string;
      native_language: string;
      ai_provider: string;
      model: string;
      generate_explanations: string;
      generating: string;
      progress: string;
      estimated_time: string;
      elapsed_time: string;
      auto_selected: string;
      refresh_models: string;
    };
    batch_operations: {
      select_all: string;
      deselect_all: string;
      select_unexplained: string;
      selected_count: string;
      selected_unexplained: string;
      delete_selected: string;
      deleting: string;
    };
    vocab_card: {
      pronunciation: string;
      context: string;
      part_of_speech: string;
      example: string;
      star: string;
      unstar: string;
      delete: string;
      no_explanation: string;
    };
    pagination: {
      previous: string;
      next: string;
      page_info: string;
      first_page: string;
      last_page: string;
      showing_items: string;
      of_total: string;
      no_data: string;
      per_page: string;
      items: string;
      go_to: string;
      page: string;
    };
    messages: {
      loading: string;
      no_vocab: string;
      no_vocab_desc: string;
      error: string;
      confirm_delete: string;
      confirm_batch_delete: string;
      delete_success: string;
      delete_failed: string;
      update_failed: string;
      generation_success: string;
      generation_failed: string;
      no_unexplained: string;
      select_unexplained_result: string;
      speech_not_supported: string;
      speech_failed: string;
      // 复习相关
      review_completed: string;
      review_close: string;
      review_progress: string;
      review_show_explanation: string;
      review_no_explanation: string;
      review_again: string;
      review_hard: string;
      review_good: string;
      review_easy: string;
      review_tomorrow: string;
      review_days_later: string;
      review_failed: string;
      review_no_due: string;
      // AI生成状态
      generation_preparing: string;
      generation_sending_request: string;
      generation_processing: string;
      generation_generating: string;
      generation_finalizing: string;
      generation_completed: string;
      generation_failed_status: string;
      // 页面描述
      page_description: string;
      review_count_placeholder: string;
      review_count_all: string;
      review_count_10: string;
      review_count_20: string;
      review_count_30: string;
      review_count_50: string;
      review_count_100: string;
      start_review: string;
      filter_conditions: string;
      ai_generation_for_selected: string;
      example_sentence_label: string;
      // 错误和状态消息
      fetch_vocab_failed: string;
      fetch_due_failed: string;
      update_status_failed: string;
      delete_failed_unknown: string;
      batch_delete_partial_failed: string;
      batch_delete_retry: string;
      generation_details: string;
    };
    status_labels: {
      new: string;
      starred: string;
      archived: string;
    };
    language_labels: {
      en: string;
      ja: string;
      zh: string;
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
    checking_login: '检查登录状态...',
    login_required: '需要登录',
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
    vocab_mode_desc_on: '拖拽选择生词或短语',
    vocab_mode_desc_off: '点击开启生词选择功能',
    click_words_to_select: '拖拽选择文本中的单词或短语',
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
    // 新增的翻译内容
    filter: '筛选',
    language: '语言',
    level: '等级',
    all_levels: '全部等级',
    practice_status: '练习状态',
    all_status: '全部状态',
    practiced: '已完成',
    unpracticed: '未开始',
    genre: '体裁',
    all_genres: '全部体裁',
    dialogue: '对话',
    monologue: '独白',
    news: '新闻',
    lecture: '讲座',
    major_theme: '大主题',
    all_major_themes: '全部大主题',
    minor_theme: '小主题',
    all_minor_themes: '全部小主题',
    select_major_theme_first: '请先选择大主题',
    search: '搜索',
    search_placeholder: '搜索标题、主题...',
    random: '随机',
    next_question: '下一题',
    total_questions: '共 {count} 题',
    completed: '已完成',
    draft: '草稿中',
    not_started: '未开始',
    play_audio: '播放音频',
    save_draft: '保存草稿',
    complete_and_save: '完成并保存',
    debug_vocab: '调试单词本',
    vocab_selection_mode: '生词选择模式',
    original_audio_text: '原文音频',
    translation: '翻译',
    show_translation: '显示翻译',
    recording_practice: '录音练习',
    recordings_count: '{count} 个录音',
    no_recordings: '还没有录音，点击"开始录音"开始练习',
    start_recording_text: '开始录音',
    practice_scoring: '练习评分',
    // 新增的按钮和界面文本翻译
    refresh_vocabulary: '刷新题库',
    select_question_to_start: '选择题目开始练习',
    click_vocabulary_button: '点击上方"题库"按钮选择题目',
    select_from_left_vocabulary: '从左侧题库中选择一个题目开始 Shadowing 练习',
    shadowing_practice: 'Shadowing 练习',
    shadowing_vocabulary: 'Shadowing 题库',
    no_questions_found: '没有找到题目',
    // 生词解释相关
    no_explanation: '暂无解释',
    explanation: '解释',
    part_of_speech: '词性',
    example_sentence: '例句',
    // 登录相关
    login_required_message: '请先登录以访问Shadowing练习功能',
    // 题目信息相关
    words: '词',
    // 评分相关
    recording_completed: '录音完成！',
    recording_completed_message: '您已完成录音，点击下方按钮进行评分',
    scoring_in_progress: '评分中...',
    scoring_result: '评分结果',
    no_recording_yet: '还没有录音',
    complete_recording_first: '请先完成录音',
    re_score: '重新评分',
    re_scoring_in_progress: '重新评分中...',
    detailed_analysis: '详细分析',
    sentence: '句子',
    issues: '问题',
    analysis_based_on_sentence_level: '分析基于句子级别，更直观地显示发音问题',
    overall_score: '整体评分',
    pronunciation_accuracy: '发音准确性',
    improvement_suggestions: '改进建议',
    practice_comparison: '练习对比',
    your_pronunciation: '你的发音',
    levels: {
      l1: 'L1 - 初级',
      l2: 'L2 - 初中级',
      l3: 'L3 - 中级',
      l4: 'L4 - 中高级',
      l5: 'L5 - 高级',
    },
    // 保存弹窗
    saving_modal_title: '保存中...',
    saving_modal_description: '正在保存练习数据，请稍候',
    // 功能说明
    functionality_guide:
      '📚 题目选择：支持日英中三语，L1-L5难度等级，智能筛选\n🎤 录音练习：音频播放、实时录音、发音对比\n🎯 智能评分：语音识别、5级评分体系\n📖 生词管理：拖拽选择生词，自动保存到生词本\n💾 进度跟踪：练习状态管理，支持草稿保存',
  },
  vocabulary: {
    title: '生词本',
    total_vocab: '共 {count} 个生词',
    filters: {
      language: '语言',
      all_languages: '全部语言',
      english: '英语',
      japanese: '日语',
      chinese: '中文',
      status: '状态',
      all_status: '全部状态',
      new_word: '新词',
      starred: '已标星',
      archived: '已归档',
      explanation_status: '解释状态',
      all_explanations: '全部解释',
      has_explanation: '已生成解释',
      missing_explanation: '未生成解释',
      search: '搜索',
      search_placeholder: '搜索生词或上下文...',
      reset: '重置',
      speech_rate: '🔊 语音速度',
    },
    ai_generation: {
      title: 'AI 解释生成设置',
      native_language: '母语',
      ai_provider: 'AI 提供商',
      model: '模型',
      generate_explanations: '生成解释',
      generating: '生成中...',
      progress: '生成进度',
      estimated_time: '预计剩余时间',
      elapsed_time: '已用时间',
      auto_selected: '💡 已根据您的个人资料自动选择',
      refresh_models: '🔄',
    },
    batch_operations: {
      select_all: '全选',
      deselect_all: '取消全选',
      select_unexplained: '🎯 选择未解释',
      selected_count: '已选择 {count} 个生词',
      selected_unexplained: '其中 {count} 个未解释',
      delete_selected: '删除选中',
      deleting: '删除中...',
    },
    vocab_card: {
      pronunciation: '发音',
      context: '上下文',
      part_of_speech: '词性',
      example: '例',
      star: '标星',
      unstar: '取消标星',
      delete: '删除',
      no_explanation: '暂无解释',
    },
    pagination: {
      previous: '上一页',
      next: '下一页',
      page_info: '第 {page} 页，共 {totalPages} 页',
      first_page: '首页',
      last_page: '末页',
      showing_items: '显示第 {start} - {end} 条，共 {total} 条',
      of_total: '共 {total} 条',
      no_data: '暂无数据',
      per_page: '每页',
      items: '条',
      go_to: '跳转到',
      page: '页',
    },
    messages: {
      loading: '加载中...',
      no_vocab: '暂无生词',
      no_vocab_desc: '去 Shadowing 练习中添加一些生词吧！',
      error: '错误',
      confirm_delete: '确定要删除这个生词吗？',
      confirm_batch_delete: '确定要删除选中的 {count} 个生词吗？此操作不可恢复！',
      delete_success: '成功删除 {count} 个生词！',
      delete_failed: '删除失败：{error}',
      update_failed: '更新失败，请重试',
      generation_success: '成功生成 {count} 个生词的解释！',
      generation_failed: '生成失败：{error}',
      no_unexplained: '当前页面没有未解释的生词',
      select_unexplained_result: '已选择 {count} 个未解释的生词\n{langText}',
      speech_not_supported: '您的浏览器不支持语音功能',
      speech_failed: '语音播放失败，请重试',
      // 复习相关
      review_completed: '今日复习完成！',
      review_close: '关闭',
      review_progress: '进度 {current} / {total}',
      review_show_explanation: '显示解释 / 例句',
      review_no_explanation: '暂无解释',
      review_again: '再来',
      review_hard: '稍难',
      review_good: '可以',
      review_easy: '容易',
      review_tomorrow: '明天',
      review_days_later: '{days}天后',
      review_failed: '获取到期生词失败',
      review_no_due: '今天没有到期的生词，明天再来！',
      // AI生成状态
      generation_preparing: '准备开始生成...',
      generation_sending_request: '正在发送请求到AI服务...',
      generation_processing: 'AI正在分析和处理 {count} 个生词...',
      generation_generating: '正在生成解释... {progress}%',
      generation_finalizing: '即将完成，正在整理结果...',
      generation_completed: '成功生成 {count} 个生词的解释！',
      generation_failed_status: '生成失败：{error}',
      // 页面描述
      page_description: '管理您的生词收藏，提升语言学习效率',
      review_count_placeholder: '复习数量',
      review_count_all: '全部',
      review_count_10: '10 条',
      review_count_20: '20 条',
      review_count_30: '30 条',
      review_count_50: '50 条',
      review_count_100: '100 条',
      start_review: '开始复习',
      filter_conditions: '筛选条件',
      ai_generation_for_selected: '为选中的 {count} 个生词生成AI解释',
      example_sentence_label: '例句',
      // 错误和状态消息
      fetch_vocab_failed: '获取生词列表失败',
      fetch_due_failed: '获取到期生词失败',
      update_status_failed: '更新生词状态失败',
      delete_failed_unknown: '未知错误',
      batch_delete_partial_failed: '，但有 {count} 个生词删除失败，请重试',
      batch_delete_retry: '，失败 {count} 个',
      generation_details: '详情：',
    },
    status_labels: {
      new: '新词',
      starred: '已标星',
      archived: '已归档',
    },
    language_labels: {
      en: '英语',
      ja: '日语',
      zh: '中文',
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
    checking_login: 'Checking login status...',
    login_required: 'Login Required',
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
    signup_success_email:
      'Registration successful. If email verification is enabled, please check your email to complete confirmation.',
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
    vocab_mode_desc_on: 'Drag to select words or phrases',
    vocab_mode_desc_off: 'Click to enable vocabulary selection feature',
    click_words_to_select: 'Drag to select words or phrases in the text',
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
    // 新增的翻译内容
    filter: 'Filter',
    language: 'Language',
    level: 'Level',
    all_levels: 'All Levels',
    practice_status: 'Practice Status',
    all_status: 'All Status',
    practiced: 'Completed',
    unpracticed: 'Not Started',
    genre: 'Genre',
    all_genres: 'All Genres',
    dialogue: 'Dialogue',
    monologue: 'Monologue',
    news: 'News',
    lecture: 'Lecture',
    major_theme: 'Major Theme',
    all_major_themes: 'All Major Themes',
    minor_theme: 'Minor Theme',
    all_minor_themes: 'All Minor Themes',
    select_major_theme_first: 'Please select a major theme first',
    search: 'Search',
    search_placeholder: 'Search titles, themes...',
    random: 'Random',
    next_question: 'Next Question',
    total_questions: '{count} questions total',
    completed: 'Completed',
    draft: 'Draft',
    not_started: 'Not Started',
    play_audio: 'Play Audio',
    save_draft: 'Save Draft',
    complete_and_save: 'Complete and Save',
    debug_vocab: 'Debug Vocabulary',
    vocab_selection_mode: 'Vocabulary Selection Mode',
    original_audio_text: 'Original Audio',
    translation: 'Translation',
    show_translation: 'Show Translation',
    recording_practice: 'Recording Practice',
    recordings_count: '{count} recordings',
    no_recordings: 'No recordings yet, click "Start Recording" to begin practice',
    start_recording_text: 'Start Recording',
    practice_scoring: 'Practice Scoring',
    // 新增的按钮和界面文本翻译
    refresh_vocabulary: 'Refresh Vocabulary',
    select_question_to_start: 'Select a question to start practice',
    click_vocabulary_button: 'Click the "Vocabulary" button above to select a question',
    select_from_left_vocabulary:
      'Select a question from the left vocabulary to start Shadowing practice',
    shadowing_practice: 'Shadowing Practice',
    shadowing_vocabulary: 'Shadowing Vocabulary',
    no_questions_found: 'No questions found',
    // 生词解释相关
    no_explanation: 'No explanation available',
    explanation: 'Explanation',
    part_of_speech: 'Part of Speech',
    example_sentence: 'Example Sentence',
    // 登录相关
    login_required_message: 'Please login to access Shadowing practice features',
    // 题目信息相关
    words: 'words',
    // 评分相关
    recording_completed: 'Recording Completed!',
    recording_completed_message: 'You have completed recording, click the button below to score',
    scoring_in_progress: 'Scoring in progress...',
    scoring_result: 'Scoring Result',
    no_recording_yet: 'No recording yet',
    complete_recording_first: 'Please complete recording first',
    re_score: 'Re-score',
    re_scoring_in_progress: 'Re-scoring in progress...',
    detailed_analysis: 'Detailed Analysis',
    sentence: 'Sentence',
    issues: 'Issues',
    analysis_based_on_sentence_level:
      'Analysis based on sentence level, more intuitively showing pronunciation issues',
    overall_score: 'Overall Score',
    pronunciation_accuracy: 'Pronunciation Accuracy',
    improvement_suggestions: 'Improvement Suggestions',
    practice_comparison: 'Practice Comparison',
    your_pronunciation: 'Your Pronunciation',
    levels: {
      l1: 'L1 - Beginner',
      l2: 'L2 - Elementary',
      l3: 'L3 - Intermediate',
      l4: 'L4 - Upper-Intermediate',
      l5: 'L5 - Advanced',
    },
    // 保存弹窗
    saving_modal_title: 'Saving...',
    saving_modal_description: 'Saving practice data, please wait',
    // 功能说明
    functionality_guide:
      '📚 Question Selection: Japanese/English/Chinese, L1-L5 levels, smart filtering\n🎤 Recording Practice: Audio playback, real-time recording, pronunciation comparison\n🎯 Smart Scoring: Speech recognition, 5-level scoring system\n📖 Vocabulary Management: Drag to select words, auto-save to vocabulary\n💾 Progress Tracking: Practice status management, draft saving support',
  },
  vocabulary: {
    title: 'Vocabulary',
    total_vocab: '{count} vocabulary words total',
    filters: {
      language: 'Language',
      all_languages: 'All Languages',
      english: 'English',
      japanese: 'Japanese',
      chinese: 'Chinese',
      status: 'Status',
      all_status: 'All Status',
      new_word: 'New',
      starred: 'Starred',
      archived: 'Archived',
      explanation_status: 'Explanation Status',
      all_explanations: 'All Explanations',
      has_explanation: 'Has Explanation',
      missing_explanation: 'Missing Explanation',
      search: 'Search',
      search_placeholder: 'Search words or context...',
      reset: 'Reset',
      speech_rate: '🔊 Speech Rate',
    },
    ai_generation: {
      title: 'AI Explanation Generation Settings',
      native_language: 'Native Language',
      ai_provider: 'AI Provider',
      model: 'Model',
      generate_explanations: 'Generate Explanations',
      generating: 'Generating...',
      progress: 'Generation Progress',
      estimated_time: 'Estimated Time Remaining',
      elapsed_time: 'Elapsed Time',
      auto_selected: '💡 Auto-selected based on your profile',
      refresh_models: '🔄',
    },
    batch_operations: {
      select_all: 'Select All',
      deselect_all: 'Deselect All',
      select_unexplained: '🎯 Select Unexplained',
      selected_count: '{count} words selected',
      selected_unexplained: '({count} unexplained)',
      delete_selected: 'Delete Selected',
      deleting: 'Deleting...',
    },
    vocab_card: {
      pronunciation: 'Pronunciation',
      context: 'Context',
      part_of_speech: 'Part of Speech',
      example: 'Example',
      star: 'Star',
      unstar: 'Unstar',
      delete: 'Delete',
      no_explanation: 'No explanation available',
    },
    pagination: {
      previous: 'Previous',
      next: 'Next',
      page_info: 'Page {page} of {totalPages}',
      first_page: 'First',
      last_page: 'Last',
      showing_items: 'Showing {start} - {end} of {total} items',
      of_total: 'of {total} items',
      no_data: 'No data',
      per_page: 'Per page',
      items: 'items',
      go_to: 'Go to',
      page: 'page',
    },
    messages: {
      loading: 'Loading...',
      no_vocab: 'No vocabulary words',
      no_vocab_desc: 'Go to Shadowing practice to add some words!',
      error: 'Error',
      confirm_delete: 'Are you sure you want to delete this word?',
      confirm_batch_delete:
        'Are you sure you want to delete {count} selected words? This action cannot be undone!',
      delete_success: 'Successfully deleted {count} words!',
      delete_failed: 'Delete failed: {error}',
      update_failed: 'Update failed, please try again',
      generation_success: 'Successfully generated explanations for {count} words!',
      generation_failed: 'Generation failed: {error}',
      no_unexplained: 'No unexplained words on current page',
      select_unexplained_result: 'Selected {count} unexplained words\n{langText}',
      speech_not_supported: 'Your browser does not support speech functionality',
      speech_failed: 'Speech playback failed, please try again',
      // 复习相关
      review_completed: 'Today\'s review completed!',
      review_close: 'Close',
      review_progress: 'Progress {current} / {total}',
      review_show_explanation: 'Show explanation / examples',
      review_no_explanation: 'No explanation available',
      review_again: 'Again',
      review_hard: 'Hard',
      review_good: 'Good',
      review_easy: 'Easy',
      review_tomorrow: 'Tomorrow',
      review_days_later: '{days} days later',
      review_failed: 'Failed to fetch due words',
      review_no_due: 'No words due today, come back tomorrow!',
      // AI生成状态
      generation_preparing: 'Preparing to start generation...',
      generation_sending_request: 'Sending request to AI service...',
      generation_processing: 'AI is analyzing and processing {count} words...',
      generation_generating: 'Generating explanations... {progress}%',
      generation_finalizing: 'Almost done, organizing results...',
      generation_completed: 'Successfully generated explanations for {count} words!',
      generation_failed_status: 'Generation failed: {error}',
      // 页面描述
      page_description: 'Manage your vocabulary collection and improve language learning efficiency',
      review_count_placeholder: 'Review count',
      review_count_all: 'All',
      review_count_10: '10 items',
      review_count_20: '20 items',
      review_count_30: '30 items',
      review_count_50: '50 items',
      review_count_100: '100 items',
      start_review: 'Start Review',
      filter_conditions: 'Filter Conditions',
      ai_generation_for_selected: 'Generate AI explanations for {count} selected words',
      example_sentence_label: 'Example',
      // 错误和状态消息
      fetch_vocab_failed: 'Failed to fetch vocabulary list',
      fetch_due_failed: 'Failed to fetch due words',
      update_status_failed: 'Failed to update word status',
      delete_failed_unknown: 'Unknown error',
      batch_delete_partial_failed: ', but {count} words failed to delete, please retry',
      batch_delete_retry: ', {count} failed',
      generation_details: 'Details: ',
    },
    status_labels: {
      new: 'New',
      starred: 'Starred',
      archived: 'Archived',
    },
    language_labels: {
      en: 'English',
      ja: 'Japanese',
      zh: 'Chinese',
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
    checking_login: 'ログイン状態を確認中...',
    login_required: 'ログインが必要です',
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
    signup_success_email:
      '登録が完了しました。メール認証が有効な場合は、メールで確認を完了してください。',
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
    vocab_mode_desc_on: '単語やフレーズをドラッグして選択',
    vocab_mode_desc_off: 'クリックして単語選択機能を有効化',
    click_words_to_select: 'テキスト内の単語やフレーズをドラッグして選択',
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
    // 新增的翻译内容
    filter: 'フィルター',
    language: '言語',
    level: 'レベル',
    all_levels: 'すべてのレベル',
    practice_status: '練習状況',
    all_status: 'すべての状況',
    practiced: '完了',
    unpracticed: '未開始',
    genre: 'ジャンル',
    all_genres: 'すべてのジャンル',
    dialogue: '対話',
    monologue: 'モノローグ',
    news: 'ニュース',
    lecture: '講義',
    major_theme: '大テーマ',
    all_major_themes: 'すべての大テーマ',
    minor_theme: '小テーマ',
    all_minor_themes: 'すべての小テーマ',
    select_major_theme_first: 'まず大テーマを選択してください',
    search: '検索',
    search_placeholder: 'タイトル、テーマを検索...',
    random: 'ランダム',
    next_question: '次の問題',
    total_questions: '合計 {count} 問',
    completed: '完了',
    draft: '下書き中',
    not_started: '未開始',
    play_audio: '音声再生',
    save_draft: '下書き保存',
    complete_and_save: '完了して保存',
    debug_vocab: '単語デバッグ',
    vocab_selection_mode: '単語選択モード',
    original_audio_text: '原文音声',
    translation: '翻訳',
    show_translation: '翻訳表示',
    recording_practice: '録音練習',
    recordings_count: '{count} 個の録音',
    no_recordings: 'まだ録音がありません。「録音開始」をクリックして練習を開始してください',
    start_recording_text: '録音開始',
    practice_scoring: '練習スコア',
    // 新增的按钮和界面文本翻译
    refresh_vocabulary: 'シャドーイング试题库更新',
    select_question_to_start: '問題を選択して練習を開始',
    click_vocabulary_button: '上の「シャドーイング试题库」ボタンをクリックして問題を選択',
    select_from_left_vocabulary:
      '左側のシャドーイング试题库から問題を選択してシャドーイング練習を開始',
    shadowing_practice: 'シャドーイング練習',
    shadowing_vocabulary: 'シャドーイング试题库',
    no_questions_found: '問題が見つかりません',
    // 生词解释相关
    no_explanation: '説明がありません',
    explanation: '説明',
    part_of_speech: '品詞',
    example_sentence: '例文',
    // 登录相关
    login_required_message: 'シャドーイング練習機能にアクセスするにはログインしてください',
    // 题目信息相关
    words: '語',
    // 评分相关
    recording_completed: '録音完了！',
    recording_completed_message: '録音が完了しました。下のボタンをクリックして採点してください',
    scoring_in_progress: '採点中...',
    scoring_result: '採点結果',
    no_recording_yet: 'まだ録音がありません',
    complete_recording_first: 'まず録音を完了してください',
    re_score: '再採点',
    re_scoring_in_progress: '再採点中...',
    detailed_analysis: '詳細分析',
    sentence: '文',
    issues: '問題',
    analysis_based_on_sentence_level: '文レベルに基づく分析で、発音の問題をより直感的に表示',
    overall_score: '総合スコア',
    pronunciation_accuracy: '発音の正確性',
    improvement_suggestions: '改善提案',
    practice_comparison: '練習比較',
    your_pronunciation: 'あなたの発音',
    levels: {
      l1: 'L1 - 初級',
      l2: 'L2 - 初中級',
      l3: 'L3 - 中級',
      l4: 'L4 - 中上級',
      l5: 'L5 - 上級',
    },
    // 保存弹窗
    saving_modal_title: '保存中...',
    saving_modal_description: '練習データを保存中です。お待ちください',
    // 功能说明
    functionality_guide:
      '📚 問題選択：日英中三言語、L1-L5レベル、スマートフィルタリング\n🎤 録音練習：音声再生、リアルタイム録音、発音比較\n🎯 スマート採点：音声認識、5段階採点システム\n📖 単語管理：ドラッグで単語選択、自動保存\n💾 進捗追跡：練習状況管理、下書き保存対応',
  },
  vocabulary: {
    title: '単語帳',
    total_vocab: '合計 {count} 語',
    filters: {
      language: '言語',
      all_languages: 'すべての言語',
      english: '英語',
      japanese: '日本語',
      chinese: '中国語',
      status: 'ステータス',
      all_status: 'すべてのステータス',
      new_word: '新規',
      starred: 'スター付き',
      archived: 'アーカイブ',
      explanation_status: '説明ステータス',
      all_explanations: 'すべての説明',
      has_explanation: '説明あり',
      missing_explanation: '説明なし',
      search: '検索',
      search_placeholder: '単語や文脈を検索...',
      reset: 'リセット',
      speech_rate: '🔊 音声速度',
    },
    ai_generation: {
      title: 'AI説明生成設定',
      native_language: '母語',
      ai_provider: 'AIプロバイダー',
      model: 'モデル',
      generate_explanations: '説明を生成',
      generating: '生成中...',
      progress: '生成進捗',
      estimated_time: '推定残り時間',
      elapsed_time: '経過時間',
      auto_selected: '💡 プロフィールに基づいて自動選択',
      refresh_models: '🔄',
    },
    batch_operations: {
      select_all: 'すべて選択',
      deselect_all: '選択解除',
      select_unexplained: '🎯 説明なしを選択',
      selected_count: '{count} 語選択中',
      selected_unexplained: '（{count} 語説明なし）',
      delete_selected: '選択したものを削除',
      deleting: '削除中...',
    },
    vocab_card: {
      pronunciation: '発音',
      context: '文脈',
      part_of_speech: '品詞',
      example: '例',
      star: 'スター',
      unstar: 'スター解除',
      delete: '削除',
      no_explanation: '説明がありません',
    },
    pagination: {
      previous: '前へ',
      next: '次へ',
      page_info: '{page} / {totalPages} ページ',
      first_page: '最初',
      last_page: '最後',
      showing_items: '{start} - {end} 件目を表示（全 {total} 件）',
      of_total: '全 {total} 件',
      no_data: 'データなし',
      per_page: '1ページあたり',
      items: '件',
      go_to: '移動',
      page: 'ページ',
    },
    messages: {
      loading: '読み込み中...',
      no_vocab: '単語がありません',
      no_vocab_desc: 'シャドーイング練習で単語を追加しましょう！',
      error: 'エラー',
      confirm_delete: 'この単語を削除してもよろしいですか？',
      confirm_batch_delete:
        '選択した {count} 語を削除してもよろしいですか？この操作は元に戻せません！',
      delete_success: '{count} 語を正常に削除しました！',
      delete_failed: '削除失敗：{error}',
      update_failed: '更新失敗、再試行してください',
      generation_success: '{count} 語の説明を正常に生成しました！',
      generation_failed: '生成失敗：{error}',
      no_unexplained: '現在のページに説明なしの単語はありません',
      select_unexplained_result: '{count} 語の説明なし単語を選択しました\n{langText}',
      speech_not_supported: 'お使いのブラウザは音声機能をサポートしていません',
      speech_failed: '音声再生に失敗しました、再試行してください',
      // 复习相关
      review_completed: '今日の復習完了！',
      review_close: '閉じる',
      review_progress: '進捗 {current} / {total}',
      review_show_explanation: '説明 / 例文を表示',
      review_no_explanation: '説明がありません',
      review_again: 'もう一度',
      review_hard: '難しい',
      review_good: '良い',
      review_easy: '簡単',
      review_tomorrow: '明日',
      review_days_later: '{days}日後',
      review_failed: '期限切れ単語の取得に失敗',
      review_no_due: '今日期限切れの単語はありません。明日また来てください！',
      // AI生成状态
      generation_preparing: '生成準備中...',
      generation_sending_request: 'AIサービスにリクエスト送信中...',
      generation_processing: 'AIが{count}語を分析・処理中...',
      generation_generating: '説明生成中... {progress}%',
      generation_finalizing: 'ほぼ完了、結果を整理中...',
      generation_completed: '{count}語の説明を正常に生成しました！',
      generation_failed_status: '生成失敗：{error}',
      // 页面描述
      page_description: '単語コレクションを管理し、言語学習効率を向上',
      review_count_placeholder: '復習数',
      review_count_all: 'すべて',
      review_count_10: '10 語',
      review_count_20: '20 語',
      review_count_30: '30 語',
      review_count_50: '50 語',
      review_count_100: '100 語',
      start_review: '復習開始',
      filter_conditions: 'フィルター条件',
      ai_generation_for_selected: '選択した{count}語のAI説明を生成',
      example_sentence_label: '例文',
      // 错误和状态消息
      fetch_vocab_failed: '単語リストの取得に失敗',
      fetch_due_failed: '期限切れ単語の取得に失敗',
      update_status_failed: '単語ステータスの更新に失敗',
      delete_failed_unknown: '不明なエラー',
      batch_delete_partial_failed: '、ただし{count}語の削除に失敗、再試行してください',
      batch_delete_retry: '、{count}語失敗',
      generation_details: '詳細：',
    },
    status_labels: {
      new: '新規',
      starred: 'スター付き',
      archived: 'アーカイブ',
    },
    language_labels: {
      en: '英語',
      ja: '日本語',
      zh: '中国語',
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
