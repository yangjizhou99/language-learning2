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
    close: string;
    expand: string;
    collapse: string;
    loading_dots: string; // 新增：带省略号的加载文本
  };

  // 首页
  home: {
    brand: string;
    hero_title: string;
    hero_subtitle: string;
    welcome_title: string;
    welcome_desc: string;
    complete_profile: string;
    cta_signup: string;
    cta_start_learning: string;
    cta_browse_features: string;
    daily_title: string;
    daily_desc: string;
    daily_language: string;
    daily_duration: string;
    daily_length: string;
    daily_cefr: string;
    daily_last_unfinished: string;
    daily_main_theme: string;
    daily_sub_theme: string;
    daily_open_practice: string;
    daily_quick_start: string;
    daily_fetching: string;
    daily_cleared: string;
    set_target_language: string;
    go_set_target_language: string;
    learn_overview: string;
    learn_overview_desc: string;
    quick_start: string;
    quick_start_desc: string;
    why_choose: string;
    why_lead: string;
    smart_learning: string;
    smart_learning_desc: string;
    progress_tracking: string;
    progress_tracking_desc: string;
    multi_mode: string;
    multi_mode_desc: string;
    ready_to_start: string;
    ready_desc: string;
    learn_more: string;
    // 学习目标模块
    goals_title: string;
    goals_edit: string;
    goals_empty_title: string;
    goals_empty_desc: string;
    goals_fill_button: string;
    goals_char_limit_hint: string;
  };

  // 个人资料页面
  profile: {
    title: string;
    subtitle: string;
    section_basic: string;
    section_preferences: string;
    username: string;
    username_placeholder: string;
    native_language: string;
    native_language_placeholder: string;
    bio: string;
    bio_placeholder: string;
    goals: string;
    goals_placeholder: string;
    target_languages: string;
    preferred_tone: string;
    preferred_tone_placeholder: string;
    interested_domains: string;
    saving: string;
    save: string;
    save_success: string;
    save_failed: string;
    load_failed: string;
    loading: string;
    registered_at: string; // e.g. 注册时间 / Registered at / 登録日時
    tones: {
      formal: string;
      casual: string;
      professional: string;
      friendly: string;
      academic: string;
    };
    domains: {
      business: string;
      technology: string;
      education: string;
      healthcare: string;
      finance: string;
      travel: string;
      entertainment: string;
      sports: string;
      news: string;
      lifestyle: string;
    };
    language_labels: Record<string, string>; // 动态语言列表显示名
    date_locales: Record<'zh' | 'en' | 'ja' | 'ko', string>; // 用于 toLocaleDateString
    // 新增：资料完成度与字段提示
    progress_title: string;
    progress_tip_prefix: string; // e.g. 完善以下字段可达100%：
    hints: {
      username: string;
      native_lang: string;
      bio: string;
      goals: string;
      target_langs: string;
      preferred_tone: string;
      domains: string;
    };
    smart_hint: {
      title: string;
      desc: string;
      s: string;
      m: string;
      a: string;
      r: string;
      t: string;
      example_label: string;
      example_text: string;
    };
  };

  // 导航
  nav: {
    home: string;
    alignment_practice: string;
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
    mode_default: string;
    mode_role: string;
    role_mode_title: string;
    role_mode_switcher_title: string;
    role_mode_switcher_hint: string;
    role_select_label: string;
    role_current_role: string;
    role_mode_hint: string;
    role_start_button: string;
    role_pause_button: string;
    role_resume_button: string;
    role_reset_button: string;
    role_toast_great: string;
    role_retry_sentence: string;
    role_skip_sentence: string;
    role_browser_unsupported: string;
    role_recognition_error: string;
    role_recording_hint: string;
    role_partner_hint: string;
    role_transcript_placeholder: string;
    role_transcript_label: string;
    role_transcript_empty: string;
    role_missing_label: string;
    role_extra_label: string;
    role_round_complete: string;
    role_no_segments: string;
    role_mode_unavailable: string;
    role_suggestion_text: string;
    role_switch_now: string;
    role_skipped: string;
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
    // Navigation and controls
    prev_step: string;
    next_step: string;
    pronounce: string;
    imported: string;
    selected_words_title: string; // with {count}
    no_new_words_to_import: string;
    ai_scoring_subtitle: string;
    ai_analysis_done: string;
    play: string;
    pause: string;
    // Feedback and suggestions
    feedback_great: string; // with {percent}
    feedback_good: string;  // with {percent}
    feedback_ok: string;    // with {percent}
    feedback_need_improvement: string; // with {percent}
    suggestions_title_text: string;
    suggestions: {
      keep_level: string;
      clearer_pronunciation: string;
      intonation_rhythm: string;
      listen_more: string;
      mind_word_pronunciation: string;
      slow_down: string;
      listen_before_practice: string;
      each_word_pronunciation: string;
      practice_in_sections: string;
      practice_more: string;
      transcription_too_short: string;
      transcription_incomplete: string;
    };
    // Issues in analysis
    issue_missing_chars: string; // with {items}
    issue_missing_words: string; // with {items}
    issue_most_missing: string;
    pronounced_as: string; // with {original} {error}
    scoring_failed: string; // with {error}
    unknown_error: string;
    // Guides
    guide_blind_listen_title: string;
    guide_blind_listen_tip1: string;
    guide_select_words_title: string;
    guide_view_translation_title: string;
    search_adjust_filters_hint: string;
    guide_view_translation_tip3: string;
    record_and_score_title: string;
    guide_record_tip1: string;
    guide_record_tip2: string;
    guide_record_tip3: string;
    previous_words_title: string; // with {count}
    duration_seconds: string; // with {seconds}
    guide_read_text_tip1: string;
    guide_read_text_tip2: string;
    guide_read_text_tip3: string;
    guide_select_words_tip1: string;
    guide_select_words_tip2: string;
    guide_select_words_tip3: string;
    guide_view_translation_tip1: string;
    guide_view_translation_tip2: string;
    // 常用动作/提示（本轮新增）
    refresh_explanation: string;
    generating: string;
    ai_explanation_button: string;
    ai_explanation_batch_button: string;
    ai_explanation_generation_progress: string;
    translation_support_hint: string;
    translation_none_title: string;
    translation_none_desc: string;
    translation_enable_action: string;
    translation_enable_hint: string;
    step_labels: {
      blind_listen: string;
      read_text: string;
      select_words: string;
      record_scoring: string;
    };
    messages: {
      add_vocab_failed: string;
      batch_ai_explanation_none_success: string;
      batch_ai_explanation_failed: string; // accepts {error}
      generate_explanation_failed: string;
      practice_completed_delayed_sync: string;
      confirm_delete_vocab: string; // with {word}
    };
    // 保存弹窗
    saving_modal_title: string;
    saving_modal_description: string;
    // 功能说明
    functionality_guide: string;
    // 分步骤引导与完成卡片
    step1_tip: string;
    step2_tip: string;
    step3_tip: string;
    step4_tip: string;
    step5_tip: string;
    practice_done_title: string;
    practice_done_desc: string;
    practice_again: string;
    back_to_catalog: string;
    // 新增：警告消息
    alert_messages: {
      microphone_permission_https: string;
      microphone_permission_settings: string;
      audio_capture_failed: string;
      speech_recognition_unavailable: string;
      browser_not_supported: string;
      audio_timeline_not_found: string;
      select_adjacent_segments: string;
      max_acu_blocks: string;
      no_content: string;
      // 新增：麦克风权限相关
      microphone_permission_denied_mobile: string;
      microphone_permission_denied_desktop: string;
      microphone_audio_capture_error: string;
      microphone_service_not_allowed: string;
      speech_recognition_not_supported: string;
      no_audio_or_timeline: string;
      no_content_message: string; // 新增：无内容提示消息
    };
    // 新增：ACU文本相关
    acu_text: {
      select_adjacent_units: string;
      max_5_units: string;
      confirm_add_to_vocab: string;
      cancel: string;
    };
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
      korean: string;
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
      ko: string;
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
    close: '关闭',
    expand: '展开',
    collapse: '折叠',
    loading_dots: '加载中...',
  },
  home: {
    brand: 'Lang Trainer',
    hero_title: 'Lang Trainer',
    hero_subtitle: '智能语言学习平台，通过多种练习模式帮助您快速提升语言能力',
    welcome_title: '欢迎使用 Lang Trainer！',
    welcome_desc: '完善您的个人资料，获得更好的学习体验',
    complete_profile: '完善个人资料',
    cta_signup: '立即注册',
    cta_start_learning: '开始学习',
    cta_browse_features: '浏览功能',
    daily_title: '每日一题（Shadowing）',
    daily_desc: '根据您的目标语言与水平，每天固定一道题进行练习',
    daily_language: '语言：',
    daily_duration: '时长：{seconds} 秒',
    daily_length: '长度：{tokens} tokens',
    daily_cefr: 'CEFR：{level}',
    daily_last_unfinished: '上次未完成',
    daily_main_theme: '大主题：{title}',
    daily_sub_theme: '小主题：{title}',
    daily_open_practice: '打开练习',
    daily_quick_start: '一键开练习',
    daily_fetching: '正在获取今日推荐{hint}',
    daily_cleared: '恭喜清空题库！可进入练习页随机练习',
    set_target_language: '尚未设置目标语言，请先',
    go_set_target_language: '去设置目标语言',
    learn_overview: '学习概览',
    learn_overview_desc: '您的学习进度和成就',
    quick_start: '快速开始',
    quick_start_desc: '选择您想要练习的内容，开始您的语言学习之旅',
    why_choose: '为什么选择 Lang Trainer？',
    why_lead: '我们提供最先进的语言学习工具和方法',
    smart_learning: '智能学习',
    smart_learning_desc: 'AI驱动的个性化学习路径，根据您的进度调整难度',
    progress_tracking: '进度跟踪',
    progress_tracking_desc: '详细的学习统计和进度分析，让您清楚了解学习效果',
    multi_mode: '多模式练习',
    multi_mode_desc: '跟读、完形填空、对齐练习等多种学习模式',
    ready_to_start: '准备开始学习了吗？',
    ready_desc: '选择您感兴趣的学习模式，立即开始您的语言学习之旅',
    learn_more: '了解更多',
    // 学习目标模块
    goals_title: '每天一点点，离目标更近一步',
    goals_edit: '编辑',
    goals_empty_title: '写下你的学习目标',
    goals_empty_desc: '为自己设定一个清晰的目标，每天前进一小步。',
    goals_fill_button: '去填写目标',
    goals_char_limit_hint: '最多500字，超出将折叠显示',
  },
  profile: {
    title: '个人资料',
    subtitle: '管理您的个人信息和学习偏好',
    section_basic: '基本信息',
    section_preferences: '学习偏好',
    username: '用户名',
    username_placeholder: '输入您的用户名',
    native_language: '母语',
    native_language_placeholder: '选择您的母语',
    bio: '个人简介',
    bio_placeholder: '介绍一下自己...',
    goals: '学习目标',
    goals_placeholder: '描述您的学习目标...',
    target_languages: '目标语言',
    preferred_tone: '偏好的语调',
    preferred_tone_placeholder: '选择您偏好的语调',
    interested_domains: '感兴趣的领域',
    saving: '保存中...',
    save: '保存资料',
    save_success: '个人资料保存成功',
    save_failed: '保存个人资料失败',
    load_failed: '加载个人资料失败',
    loading: '加载中...',
    registered_at: '注册时间',
    tones: {
      formal: '正式',
      casual: '随意',
      professional: '专业',
      friendly: '友好',
      academic: '学术',
    },
    domains: {
      business: '商务',
      technology: '科技',
      education: '教育',
      healthcare: '医疗',
      finance: '金融',
      travel: '旅游',
      entertainment: '娱乐',
      sports: '体育',
      news: '新闻',
      lifestyle: '生活',
    },
    language_labels: {
      zh: '中文',
      en: 'English',
      ja: '日本語',
      ko: '한국어',
      fr: 'Français',
      de: 'Deutsch',
      es: 'Español',
      it: 'Italiano',
      pt: 'Português',
      ru: 'Русский',
    },
    date_locales: { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' },
    progress_title: '资料完成度',
    progress_tip_prefix: '完善以下字段可达 100%：',
    hints: {
      username: '填写用户名可提升资料完成度',
      native_lang: '请选择母语',
      bio: '填写个人简介有助于生成更贴合的学习内容',
      goals: '描述你的学习目标，系统将更好地推荐练习',
      target_langs: '请选择至少一个目标语言',
      preferred_tone: '选择偏好语气，便于生成合适的内容风格',
      domains: '选择兴趣领域，系统将更懂你的偏好',
    },
    smart_hint: {
      title: '用 SMART 法则来描述目标',
      desc: '让目标更清晰、更可执行：',
      s: 'S（具体 Specific）：明确你要达成的内容',
      m: 'M（可衡量 Measurable）：量化标准，如次数或分数',
      a: 'A（可实现 Achievable）：结合当前水平与时间设定',
      r: 'R（相关 Relevant）：与你的长期方向一致',
      t: 'T（时限 Time-bound）：设定完成的时间范围',
      example_label: '示例',
      example_text: '例如：在2个月内完成40次跟读练习，并通过L2难度评分≥80分。',
    },
  },
  nav: {
    home: '首页',
    alignment_practice: '对齐练习',
    shadowing: '跟读练习',
    vocabulary: '单词本',
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
    mode_default: '逐句练习',
    mode_role: '分角色对话',
    role_mode_title: '分角色练习',
    role_mode_switcher_title: '练习模式',
    role_mode_switcher_hint: '可在普通逐句与分角色对话之间切换',
    role_select_label: '选择角色',
    role_current_role: '当前角色',
    role_mode_hint: '轮到对方时自动播放，轮到你时会自动录音并分析。',
    role_start_button: '开始角色练习',
    role_pause_button: '暂停',
    role_retry_sentence: '重练本句',
    role_skip_sentence: '跳过此句',
    role_browser_unsupported: '当前浏览器不支持自动录音，请使用最新版 Chrome 体验该功能。',
    role_recognition_error: '语音识别失败，请检查麦克风权限或稍后重试。',
    role_recording_hint: '正在录音',
    role_partner_hint: '请倾听对方台词',
    role_transcript_placeholder: '语音识别结果会显示在这里',
    role_transcript_label: '你的转录',
    role_transcript_empty: '（无识别结果）',
    role_missing_label: '遗漏',
    role_extra_label: '多余',
    role_round_complete: '本轮练习已完成，选择其他角色再练习吧！',
    role_no_segments: '当前材料暂不支持分角色练习。',
    role_mode_unavailable: '当前素材暂不支持分角色练习',
    role_suggestion_text: '切换到其他角色继续练习：',
    role_switch_now: '立即切换',
    role_skipped: '已跳过',
    role_resume_button: '继续',
    role_reset_button: '重新开始',
    role_toast_great: '做得很好！这句练得不错 👍',
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
    // Navigation and controls
    prev_step: '上一步',
    next_step: '下一步',
    pronounce: '发音',
    imported: '已导入',
    selected_words_title: '本次选中的生词 ({count})',
    no_new_words_to_import: '没有新的生词可以导入',
    ai_scoring_subtitle: 'AI智能评分，精准分析发音',
    ai_analysis_done: 'AI智能分析完成',
    play: '播放',
    pause: '暂停',
    // Feedback and suggestions
    feedback_great: '发音准确率: {percent}%，非常棒！',
    feedback_good: '发音准确率: {percent}%，很好！',
    feedback_ok: '发音准确率: {percent}%，还不错',
    feedback_need_improvement: '发音准确率: {percent}%，需要加强练习',
    suggestions_title_text: '建议：',
    suggestions: {
      keep_level: '继续保持这个水平！',
      clearer_pronunciation: '可以尝试更清晰地发音',
      intonation_rhythm: '注意语调和节奏',
      listen_more: '建议多听几遍原文',
      mind_word_pronunciation: '注意单词的发音',
      slow_down: '可以尝试放慢语速',
      listen_before_practice: '建议先听几遍原文再练习',
      each_word_pronunciation: '注意每个单词的发音',
      practice_in_sections: '可以分段练习',
      practice_more: '多练习几次会更好',
      transcription_too_short: '转录内容较少，建议重新录音',
      transcription_incomplete: '转录内容不完整，建议重新录音',
    },
    issue_missing_chars: '遗漏字符: {items}',
    issue_missing_words: '遗漏单词: {items}',
    issue_most_missing: '大部分内容未说出',
    pronounced_as: '"{original}" 说成了 "{error}"',
    scoring_failed: '评分失败: {error}',
    unknown_error: '未知错误',
    // Guides
    guide_blind_listen_title: '如何高效盲听：',
    guide_blind_listen_tip1: '准备好后点击"下一步"，再看原文跟读',
    guide_select_words_title: '选生词 + AI 解释：',
    guide_view_translation_title: '查看翻译：',
    search_adjust_filters_hint: '试试调整筛选条件或搜索关键词',
    guide_view_translation_tip3: '理解后可返回原文再跟读一遍，强化记忆',
    record_and_score_title: '录音与评分：',
    guide_record_tip1: '对照原文逐句录音，尽量贴合节奏与停顿',
    guide_record_tip2: '录完保存后点击评分，查看整体与逐句分析',
    guide_record_tip3: '根据问题提示再次练习可显著提升分数',
    previous_words_title: '之前的生词 ({count})',
    duration_seconds: '时长: {seconds}秒',
    guide_read_text_tip1: '先快速浏览一遍原文结构与段落',
    guide_read_text_tip2: '再次播放音频，对照原文跟读（注意连读/重音）',
    guide_read_text_tip3: '跟读时轻声起步，逐步提升音量与流畅度',
    guide_select_words_tip1: '点击原文中的词语即可加入生词',
    guide_select_words_tip2: '点击"AI解释"为生词生成本地化释义与例句',
    guide_select_words_tip3: '建议聚焦于影响理解的关键词汇，避免一次选太多',
    guide_view_translation_tip1: '优先显示你的母语翻译，理解语义与细节',
    guide_view_translation_tip2: '遇到不通顺的地方，回放原文定位比对',
    // 常用动作/提示（本轮新增）
    refresh_explanation: '刷新解释',
    generating: '生成中...',
    ai_explanation_button: 'AI解释',
    ai_explanation_batch_button: '一键AI解释',
    ai_explanation_generation_progress: 'AI解释生成进度',
    translation_support_hint: '多语言翻译支持',
    translation_none_title: '暂无翻译',
    translation_none_desc: '可能尚未生成翻译内容',
    translation_enable_action: '开启翻译功能',
    translation_enable_hint: '勾选上方选项以显示翻译内容',
    step_labels: {
      blind_listen: '盲听',
      read_text: '看原文+翻译',
      select_words: '选生词',
      record_scoring: '录音评分',
    },
    messages: {
      add_vocab_failed: '添加生词失败，请重试',
      batch_ai_explanation_none_success: '没有成功生成任何AI解释，请重试',
      batch_ai_explanation_failed: '批量生成AI解释失败：{error}',
      generate_explanation_failed: '生成解释失败，请重试',
      practice_completed_delayed_sync: '练习已完成，但部分数据同步可能延迟',
      confirm_delete_vocab: '确定要删除生词 "{word}" 吗？这将从生词表中永久删除。',
    },
    // 保存弹窗
    saving_modal_title: '保存中...',
    saving_modal_description: '正在保存练习数据，请稍候',
    // 功能说明
    functionality_guide:
      '📚 题目选择：支持日英中三语，L1-L5难度等级，智能筛选\n🎤 录音练习：音频播放、实时录音、发音对比\n🎯 智能评分：语音识别、5级评分体系\n📖 生词管理：拖拽选择生词，自动保存到生词本\n💾 进度跟踪：练习状态管理，支持草稿保存',
    // 分步骤引导与完成卡片
    step1_tip: 'Step 1 · 盲听：先完整听一遍，不看原文。准备好后点击"下一步"。',
    step2_tip: 'Step 2 · 看原文+翻译跟读：现在可以看原文和翻译，再听一遍并跟读。',
    step3_tip: 'Step 3 · 生词选择：开启生词模式，点击原文选取生词，并点击 AI 解释。',
    step4_tip: 'Step 4 · 录音评分：开始录音并评分，此时仅保留原文，其它模块隐藏。',
    step5_tip: 'Step 5 · 完成：练习已完成，可以查看评分结果或重新练习。',
    practice_done_title: '练习已完成',
    practice_done_desc: '成绩与生词已保存，你可以选择继续提升',
    practice_again: '再练一次',
    back_to_catalog: '返回题库',
    // 新增：警告消息
    alert_messages: {
      microphone_permission_https: '请确保您的浏览器支持HTTPS连接，否则录音功能可能无法正常工作。',
      microphone_permission_settings: '请检查您的麦克风权限设置，确保录音功能已启用。',
      audio_capture_failed: '录音过程中出现错误，请检查麦克风或网络连接。',
      speech_recognition_unavailable: '语音识别功能不可用，请检查网络连接或稍后再试。',
      browser_not_supported: '当前浏览器不支持录音功能，请使用最新版Chrome浏览器。',
      audio_timeline_not_found: '未找到音频时间线，请检查录音文件是否完整。',
      select_adjacent_segments: '请选择相邻的音频段落进行录音。',
      max_acu_blocks: '录音文件超过最大限制，请分段录音。',
      no_content: '录音文件为空，请重新录音。',
      // 新增：麦克风权限相关
      microphone_permission_denied_mobile: '您的移动设备未授权录音权限，请在设置中启用录音权限。',
      microphone_permission_denied_desktop: '您的桌面设备未授权录音权限，请在设置中启用录音权限。',
      microphone_audio_capture_error: '录音过程中出现错误，请检查麦克风或网络连接。',
      microphone_service_not_allowed: '录音服务未被允许，请检查麦克风权限设置。',
      speech_recognition_not_supported: '当前浏览器不支持语音识别功能，请使用最新版Chrome浏览器。',
      no_audio_or_timeline: '未检测到音频或音频时间线，请检查录音文件是否完整。',
      no_content_message: '录音文件为空，请重新录音。', // 新增：无内容提示消息
    },
    // 新增：ACU文本相关
    acu_text: {
      select_adjacent_units: '选择相邻的单元',
      max_5_units: '最多5个单元',
      confirm_add_to_vocab: '确认添加到生词本',
      cancel: '取消',
    },
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
      korean: '韩语',
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
      ko: '韩语',
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
    close: 'Close',
    expand: 'Expand',
    collapse: 'Collapse',
    loading_dots: 'Loading...',
  },
  home: {
    brand: 'Lang Trainer',
    hero_title: 'Lang Trainer',
    hero_subtitle:
      'An intelligent language learning platform with multiple practice modes to help you improve quickly',
    welcome_title: 'Welcome to Lang Trainer!',
    welcome_desc: 'Complete your profile to get a better learning experience',
    complete_profile: 'Complete Profile',
    cta_signup: 'Sign Up',
    cta_start_learning: 'Start Learning',
    cta_browse_features: 'Browse Features',
    daily_title: 'Daily Question (Shadowing)',
    daily_desc: 'One fixed practice per day based on your target language and level',
    daily_language: 'Language: ',
    daily_duration: 'Duration: {seconds} sec',
    daily_length: 'Length: {tokens} tokens',
    daily_cefr: 'CEFR: {level}',
    daily_last_unfinished: 'Last unfinished',
    daily_main_theme: 'Major theme: {title}',
    daily_sub_theme: 'Minor theme: {title}',
    daily_open_practice: 'Open Practice',
    daily_quick_start: 'Quick Start',
    daily_fetching: 'Fetching today\'s recommendation{hint}',
    daily_cleared: 'Congrats! Catalog cleared. Go to practice for random exercises.',
    set_target_language: 'Target language not set, please',
    go_set_target_language: 'Set target language',
    learn_overview: 'Learning Overview',
    learn_overview_desc: 'Your learning progress and achievements',
    quick_start: 'Quick Start',
    quick_start_desc: 'Pick what you want to practice to start your journey',
    why_choose: 'Why choose Lang Trainer?',
    why_lead: 'We provide state-of-the-art tools and methods',
    smart_learning: 'Smart Learning',
    smart_learning_desc:
      'AI-powered personalized path that adapts difficulty based on your progress',
    progress_tracking: 'Progress Tracking',
    progress_tracking_desc:
      'Detailed study statistics and analysis so you clearly see results',
    multi_mode: 'Multi-mode Practice',
    multi_mode_desc: 'Shadowing, Cloze, Alignment and more',
    ready_to_start: 'Ready to start learning?',
    ready_desc:
      'Choose a practice mode you are interested in and start your journey now',
    learn_more: 'Learn More',
    // Goals module
    goals_title: 'Small steps daily, big goals achieved',
    goals_edit: 'Edit',
    goals_empty_title: 'Write down your learning goals',
    goals_empty_desc: 'Set a clear goal and make small progress every day.',
    goals_fill_button: 'Go fill goals',
    goals_char_limit_hint: 'Up to 500 chars, overflow will be collapsed',
  },
  profile: {
    title: 'Profile',
    subtitle: 'Manage your personal info and learning preferences',
    section_basic: 'Basic Info',
    section_preferences: 'Learning Preferences',
    username: 'Username',
    username_placeholder: 'Enter your username',
    native_language: 'Native Language',
    native_language_placeholder: 'Select your native language',
    bio: 'Bio',
    bio_placeholder: 'Tell us about yourself...',
    goals: 'Learning Goals',
    goals_placeholder: 'Describe your learning goals...',
    target_languages: 'Target Languages',
    preferred_tone: 'Preferred Tone',
    preferred_tone_placeholder: 'Select your preferred tone',
    interested_domains: 'Interested Domains',
    saving: 'Saving...',
    save: 'Save Profile',
    save_success: 'Profile saved successfully',
    save_failed: 'Failed to save profile',
    load_failed: 'Failed to load profile',
    loading: 'Loading...',
    registered_at: 'Registered at',
    tones: {
      formal: 'Formal',
      casual: 'Casual',
      professional: 'Professional',
      friendly: 'Friendly',
      academic: 'Academic',
    },
    domains: {
      business: 'Business',
      technology: 'Technology',
      education: 'Education',
      healthcare: 'Healthcare',
      finance: 'Finance',
      travel: 'Travel',
      entertainment: 'Entertainment',
      sports: 'Sports',
      news: 'News',
      lifestyle: 'Lifestyle',
    },
    language_labels: {
      zh: 'Chinese',
      en: 'English',
      ja: 'Japanese',
      ko: 'Korean',
      fr: 'French',
      de: 'German',
      es: 'Spanish',
      it: 'Italian',
      pt: 'Portuguese',
      ru: 'Russian',
    },
    date_locales: { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' },
    progress_title: 'Profile completeness',
    progress_tip_prefix: 'Complete the following to reach 100%: ',
    hints: {
      username: 'Filling in a username improves your profile completeness',
      native_lang: 'Please select your native language',
      bio: 'Add a bio to help personalize your learning content',
      goals: 'Describe your learning goals to improve recommendations',
      target_langs: 'Select at least one target language',
      preferred_tone: 'Choose a preferred tone to match content style',
      domains: 'Pick interests so the system understands your preferences',
    },
    smart_hint: {
      title: 'Use the SMART framework for goals',
      desc: 'Make your goals clear and actionable:',
      s: 'S (Specific): Clearly define what to achieve',
      m: 'M (Measurable): Quantify with counts or scores',
      a: 'A (Achievable): Fit your current level and time',
      r: 'R (Relevant): Align with your long-term direction',
      t: 'T (Time-bound): Set a time frame',
      example_label: 'Example',
      example_text: 'E.g., finish 40 shadowing sessions in 2 months and score ≥80 at L2.',
    },
  },
  nav: {
    home: 'Home',
    alignment_practice: 'Alignment Practice',
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
    mode_default: 'Sentence Practice',
    mode_role: 'Role Dialogue',
    role_mode_title: 'Role Practice',
    role_mode_switcher_title: 'Practice Mode',
    role_mode_switcher_hint: 'Switch between sentence practice and role-based dialogue',
    role_select_label: 'Choose Role',
    role_current_role: 'Current Role',
    role_mode_hint:
      'Partner lines play automatically; when it is your turn we will record automatically.',
    role_start_button: 'Start Role Practice',
    role_pause_button: 'Pause',
    role_retry_sentence: 'Retry Sentence',
    role_skip_sentence: 'Skip Sentence',
    role_browser_unsupported:
      'Automatic recording is not supported in this browser. Please use the latest Chrome.',
    role_recognition_error:
      'Speech recognition failed. Please check microphone permissions and try again.',
    role_recording_hint: 'Recording...',
    role_partner_hint: 'Listen to your partner',
    role_transcript_placeholder: 'Speech recognition transcript will appear here',
    role_transcript_label: 'Your transcript',
    role_transcript_empty: '(No transcript)',
    role_missing_label: 'Missing',
    role_extra_label: 'Extra',
    role_round_complete: 'Round finished! Choose another role to continue.',
    role_no_segments: 'This material does not support role practice yet.',
    role_mode_unavailable: 'Role practice is not available for this content',
    role_suggestion_text: 'Switch to another role to continue:',
    role_switch_now: 'Switch now',
    role_skipped: 'Skipped',
    role_resume_button: 'Resume',
    role_reset_button: 'Restart',
    role_toast_great: 'Great job! That line sounded solid 👍',
    // 新增的按钮和界面文本翻译
    refresh_vocabulary: 'Refresh Vocabulary',
    select_question_to_start: 'Select a question to start practice',
    click_vocabulary_button: 'Click the "Catalog" button above to select a question',
    select_from_left_vocabulary:
      'Select a question from the left vocabulary to start Shadowing practice',
    shadowing_practice: 'Shadowing Practice',
    shadowing_vocabulary: 'Shadowing Catalog',
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
    // Navigation and controls
    prev_step: 'Previous',
    next_step: 'Next',
    pronounce: 'Pronounce',
    imported: 'Imported',
    selected_words_title: 'Selected words this time ({count})',
    no_new_words_to_import: 'No new words to import',
    ai_scoring_subtitle: 'AI scoring with precise pronunciation analysis',
    ai_analysis_done: 'AI analysis completed',
    play: 'Play',
    pause: 'Pause',
    // Feedback and suggestions
    feedback_great: 'Pronunciation accuracy: {percent}%. Excellent!',
    feedback_good: 'Pronunciation accuracy: {percent}%. Great!',
    feedback_ok: 'Pronunciation accuracy: {percent}%. Not bad.',
    feedback_need_improvement: 'Pronunciation accuracy: {percent}%. Needs improvement.',
    suggestions_title_text: 'Suggestions:',
    suggestions: {
      keep_level: 'Keep up the good work!',
      clearer_pronunciation: 'Try to pronounce more clearly',
      intonation_rhythm: 'Pay attention to intonation and rhythm',
      listen_more: 'Listen to the original a few more times',
      mind_word_pronunciation: 'Mind the pronunciation of words',
      slow_down: 'Try slowing down your speaking rate',
      listen_before_practice: 'Listen several times before practicing',
      each_word_pronunciation: 'Focus on each word\'s pronunciation',
      practice_in_sections: 'Practice in sections',
      practice_more: 'Practice more for better results',
      transcription_too_short: 'Transcription is too short; consider re-recording',
      transcription_incomplete: 'Transcription incomplete; consider re-recording',
    },
    issue_missing_chars: 'Missing characters: {items}',
    issue_missing_words: 'Missing words: {items}',
    issue_most_missing: 'Most of the content was not spoken',
    pronounced_as: '"{original}" pronounced as "{error}"',
    scoring_failed: 'Scoring failed: {error}',
    unknown_error: 'Unknown error',
    // Guides
    guide_blind_listen_title: 'How to blind-listen effectively:',
    guide_blind_listen_tip1: 'Click "Next" when ready, then read along with text',
    guide_select_words_title: 'Pick words + AI explanation:',
    guide_view_translation_title: 'View translation:',
    search_adjust_filters_hint: 'Try adjusting filters or search keywords',
    guide_view_translation_tip3: 'After understanding, shadow again to reinforce memory',
    record_and_score_title: 'Record & Score:',
    guide_record_tip1: 'Record sentence-by-sentence following the original pacing',
    guide_record_tip2: 'Save and click score to see overall and per-sentence analysis',
    guide_record_tip3: 'Practice again based on issues to significantly improve',
    previous_words_title: 'Previously selected words ({count})',
    duration_seconds: 'Duration: {seconds}s',
    guide_read_text_tip1: 'Quickly browse the text structure and paragraphs',
    guide_read_text_tip2: 'Play again and shadow with the text (watch linking/stress)',
    guide_read_text_tip3: 'Start softly and gradually increase volume and fluency',
    guide_select_words_tip1: 'Click words in the text to add to vocabulary',
    guide_select_words_tip2: 'Click "AI Explanation" to generate localized gloss and examples',
    guide_select_words_tip3: 'Focus on key words; avoid selecting too many at once',
    guide_view_translation_tip1: 'Prefer your native translation to understand meaning and details',
    guide_view_translation_tip2: 'Replay the original to compare when something feels unclear',
    // Common actions/prompts (new)
    refresh_explanation: 'Refresh explanation',
    generating: 'Generating...',
    ai_explanation_button: 'AI Explanation',
    ai_explanation_batch_button: 'Batch AI Explanation',
    ai_explanation_generation_progress: 'AI Explanation Progress',
    translation_support_hint: 'Multi-language translation support',
    translation_none_title: 'No translation',
    translation_none_desc: 'Translation may not be generated yet',
    translation_enable_action: 'Enable translation',
    translation_enable_hint: 'Check the option above to show translation',
    step_labels: {
      blind_listen: 'Blind Listen',
      read_text: 'View Text + Translation',
      select_words: 'Pick Words',
      record_scoring: 'Record & Score',
    },
    messages: {
      add_vocab_failed: 'Failed to add vocabulary, please try again',
      batch_ai_explanation_none_success: 'No AI explanations were generated, please retry',
      batch_ai_explanation_failed: 'Batch AI explanation failed: {error}',
      generate_explanation_failed: 'Failed to generate explanation, please retry',
      practice_completed_delayed_sync: 'Practice completed. Some data may sync with delay',
      confirm_delete_vocab: 'Delete "{word}" from vocabulary? This action cannot be undone.',
    },
    // 保存弹窗
    saving_modal_title: 'Saving...',
    saving_modal_description: 'Saving practice data, please wait',
    // 功能说明
    functionality_guide:
      '📚 Question Selection: Japanese/English/Chinese, L1-L5 levels, smart filtering\n🎤 Recording Practice: Audio playback, real-time recording, pronunciation comparison\n🎯 Smart Scoring: Speech recognition, 5-level scoring system\n📖 Vocabulary Management: Drag to select words, auto-save to vocabulary\n💾 Progress Tracking: Practice status management, draft saving support',
    // Step tips and done card
    step1_tip: 'Step 1 · Blind listen: play once without reading. Click Next when ready.',
    step2_tip: 'Step 2 · Read + translation + shadow: view the text and translation, read along with playback.',
    step3_tip: 'Step 3 · Pick words: enable vocab mode, tap words, and generate AI explanations.',
    step4_tip: 'Step 4 · Record & score: record and score; only original text is shown.',
    step5_tip: 'Step 5 · Complete: practice completed, you can view scores or practice again.',
    practice_done_title: 'Practice Completed',
    practice_done_desc: 'Scores and words saved. You can continue improving.',
    practice_again: 'Practice Again',
    back_to_catalog: 'Back to Catalog',
    // 新增：警告消息
    alert_messages: {
      microphone_permission_https: 'Please ensure your browser supports HTTPS connections, otherwise the recording feature may not work properly.',
      microphone_permission_settings: 'Please check your microphone permissions settings to ensure the recording feature is enabled.',
      audio_capture_failed: 'An error occurred while recording audio. Please check your microphone or network connection and try again.',
      speech_recognition_unavailable: 'Speech recognition is not available in your browser. Please try again later or use a different browser.',
      browser_not_supported: 'This browser does not support the recording feature. Please use the latest version of Chrome.',
      audio_timeline_not_found: 'Audio timeline not found. Please try again or check your recording file.',
      select_adjacent_segments: 'Please select adjacent audio segments for recording.',
      max_acu_blocks: 'Recording file exceeds maximum limit. Please split the recording into smaller segments.',
      no_content: 'Recording file is empty. Please try again or check your microphone.',
      // 新增：麦克风权限相关
      microphone_permission_denied_mobile: 'Your mobile device has not granted microphone permission. Please check your settings and try again.',
      microphone_permission_denied_desktop: 'Your desktop device has not granted microphone permission. Please check your settings and try again.',
      microphone_audio_capture_error: 'An error occurred while capturing audio. Please check your microphone or network connection and try again.',
      microphone_service_not_allowed: 'The microphone service is not allowed. Please check your settings and try again.',
      speech_recognition_not_supported: 'Speech recognition is not supported in your browser. Please use the latest version of Chrome.',
      no_audio_or_timeline: 'No audio detected or audio timeline not found. Please check your recording file and try again.',
      no_content_message: 'Recording file is empty. Please try again or check your microphone.', // 新增：无内容提示消息
    },
    // 新增：ACU文本相关
    acu_text: {
      select_adjacent_units: 'Select adjacent units',
      max_5_units: 'Max 5 units',
      confirm_add_to_vocab: 'Confirm Add to Vocabulary',
      cancel: 'Cancel',
    },
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
      korean: 'Korean',
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
      generation_generating: '正在生成解释... {progress}%',
      generation_finalizing: '即将完成，正在整理结果...',
      generation_completed: 'Successfully generated explanations for {count} words!',
      generation_failed_status: '生成失败：{error}',
      // 页面描述
      page_description: 'Manage your vocabulary collection and improve language learning efficiency',
      review_count_placeholder: 'Review count',
      review_count_all: '全部',
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
      batch_delete_retry: '，失败 {count} 个',
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
      ko: 'Korean',
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
    close: '閉じる',
    expand: '展開',
    collapse: '折りたたむ',
    loading_dots: '読み込み中...',
  },
  home: {
    brand: 'Lang Trainer',
    hero_title: 'Lang Trainer',
    hero_subtitle:
      '多様な練習モードで素早く上達を支援するスマート学習プラットフォーム',
    welcome_title: 'Lang Trainer へようこそ！',
    welcome_desc: 'より良い体験のため、プロフィールを完成させましょう',
    complete_profile: 'プロフィールを完成',
    cta_signup: '今すぐ登録',
    cta_start_learning: '学習を開始',
    cta_browse_features: '機能を見る',
    daily_title: '毎日一題（シャドーイング）',
    daily_desc: '目標言語とレベルに応じて、毎日1問を出題',
    daily_language: '言語：',
    daily_duration: '所要時間：{seconds} 秒',
    daily_length: '長さ：{tokens} tokens',
    daily_cefr: 'CEFR：{level}',
    daily_last_unfinished: '前回未完了',
    daily_main_theme: '大テーマ：{title}',
    daily_sub_theme: '小テーマ：{title}',
    daily_open_practice: '練習を開く',
    daily_quick_start: 'ワンクリック開始',
    daily_fetching: '本日のおすすめを取得中{hint}',
    daily_cleared: 'おめでとうございます！題庫をクリアしました。ランダム練習へ',
    set_target_language: '目標言語が未設定、まずは',
    go_set_target_language: '目標言語を設定',
    learn_overview: '学習概要',
    learn_overview_desc: 'あなたの学習進捗と実績',
    quick_start: 'クイックスタート',
    quick_start_desc: '練習内容を選び、学習の旅を始めましょう',
    why_choose: 'なぜ Lang Trainer？',
    why_lead: '最先端の学習ツールと方法を提供します',
    smart_learning: 'スマート学習',
    smart_learning_desc: 'AIが進捗に応じて難易度を調整',
    progress_tracking: '進捗トラッキング',
    progress_tracking_desc: '詳細な統計と分析で効果を可視化',
    multi_mode: '多様な練習',
    multi_mode_desc: 'シャドーイング、穴埋め、アライメントなど',
    ready_to_start: '学習を始めますか？',
    ready_desc: '興味のあるモードを選んで今すぐ開始',
    learn_more: '詳細を見る',
    // 目標モジュール
    goals_title: '毎日少しずつ、目標に近づこう',
    goals_edit: '編集',
    goals_empty_title: '学習目標を書きましょう',
    goals_empty_desc: '明確な目標を設定し、毎日少しずつ前進。',
    goals_fill_button: '目標を記入',
    goals_char_limit_hint: '最大500文字、超過分は折りたたみ表示',
  },
  profile: {
    title: 'プロフィール',
    subtitle: '個人情報と言語学習の設定を管理する',
    section_basic: '基本情報',
    section_preferences: '学習設定',
    username: 'ユーザー名',
    username_placeholder: 'ユーザー名を入力',
    native_language: '母語',
    native_language_placeholder: '母語を選択',
    bio: '自己紹介',
    bio_placeholder: '自己紹介を書いてください...',
    goals: '学習目標',
    goals_placeholder: '学習目標を記入してください...',
    target_languages: '目標言語',
    preferred_tone: '好みの文体',
    preferred_tone_placeholder: '好みの文体を選択',
    interested_domains: '興味のある分野',
    saving: '保存中...',
    save: 'プロフィールを保存',
    save_success: 'プロフィールを保存しました',
    save_failed: 'プロフィールの保存に失敗しました',
    load_failed: 'プロフィールの読み込みに失敗しました',
    loading: '読み込み中...',
    registered_at: '登録日時',
    tones: {
      formal: 'フォーマル',
      casual: 'カジュアル',
      professional: 'プロフェッショナル',
      friendly: 'フレンドリー',
      academic: 'アカデミック',
    },
    domains: {
      business: 'ビジネス',
      technology: 'テクノロジー',
      education: '教育',
      healthcare: '医療',
      finance: '金融',
      travel: '旅行',
      entertainment: 'エンタメ',
      sports: 'スポーツ',
      news: 'ニュース',
      lifestyle: 'ライフスタイル',
    },
    language_labels: {
      zh: '中国語',
      en: '英語',
      ja: '日本語',
      ko: '韓国語',
      fr: 'フランス語',
      de: 'ドイツ語',
      es: 'スペイン語',
      it: 'イタリア語',
      pt: 'ポルトガル語',
      ru: 'ロシア語',
    },
    date_locales: { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' },
    progress_title: 'プロフィール完成度',
    progress_tip_prefix: '以下を入力すると 100% に到達：',
    hints: {
      username: 'ユーザー名を入力するとプロフィール完成度が上がります',
      native_lang: '母語を選択してください',
      bio: '自己紹介を書くと学習内容のパーソナライズに役立ちます',
      goals: '学習目標を記入すると推薦が改善されます',
      target_langs: '目標言語を少なくとも一つ選択してください',
      preferred_tone: '好みの文体を選ぶと内容スタイルが合います',
      domains: '興味分野を選ぶと好みをより理解できます',
    },
    smart_hint: {
      title: 'SMART で目標を書こう',
      desc: '目標を明確かつ実行可能に：',
      s: 'S（具体的 Specific）：達成内容を明確に',
      m: 'M（測定可能 Measurable）：回数やスコアで定量化',
      a: 'A（達成可能 Achievable）：現在のレベルと時間に合わせる',
      r: 'R（関連性 Relevant）：長期目標と一致させる',
      t: 'T（期限 Time-bound）：期限を設定する',
      example_label: '例',
      example_text: '例：2ヶ月で40回のシャドーイングを完了し、L2で80点以上を達成。',
    },
  },
  nav: {
    home: 'ホーム',
    alignment_practice: 'アライメント練習',
    shadowing: 'シャドーイング',
    vocabulary: '題庫',
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
    mode_default: '文単位の練習',
    mode_role: '役割別対話',
    role_mode_title: '役割練習',
    role_mode_switcher_title: '練習モード',
    role_mode_switcher_hint: '通常の逐語練習と役割対話を切り替えられます',
    role_select_label: '役割を選択',
    role_current_role: '現在の役割',
    role_mode_hint: '相手の番では自動再生、あなたの番では自動的に録音と分析を行います。',
    role_start_button: '役割練習を開始',
    role_pause_button: '一時停止',
    role_retry_sentence: 'もう一度このセリフ',
    role_skip_sentence: 'このセリフをスキップ',
    role_browser_unsupported:
      'このブラウザでは自動録音が利用できません。最新の Chrome をご利用ください。',
    role_recognition_error:
      '音声認識に失敗しました。マイク権限を確認して再試行してください。',
    role_recording_hint: '録音中…',
    role_partner_hint: '相手のセリフを聞きましょう',
    role_transcript_placeholder: '音声認識結果がここに表示されます',
    role_transcript_label: 'あなたの書き起こし',
    role_transcript_empty: '（認識結果なし）',
    role_missing_label: '不足',
    role_extra_label: '余分',
    role_round_complete: 'この役割の練習が完了しました。別の役割でも練習してみましょう！',
    role_no_segments: 'この素材はまだ役割練習に対応していません。',
    role_mode_unavailable: 'このコンテンツでは役割練習を利用できません',
    role_suggestion_text: '別の役割で練習を続けましょう：',
    role_switch_now: '切り替える',
    role_skipped: 'スキップ済み',
    role_resume_button: '再開',
    role_reset_button: 'リセット',
    role_toast_great: '素晴らしい！このセリフはとても良かったです 👍',
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
    // Navigation and controls
    prev_step: '前へ',
    next_step: '次へ',
    pronounce: '発音',
    imported: 'インポート済み',
    selected_words_title: '今回選択した単語 ({count})',
    no_new_words_to_import: 'インポートできる新しい単語はありません',
    ai_scoring_subtitle: 'AI採点で発音を精密分析',
    ai_analysis_done: 'AI分析が完了しました',
    play: '再生',
    pause: '一時停止',
    // Feedback and suggestions
    feedback_great: '発音の正確性: {percent}%、素晴らしい！',
    feedback_good: '発音の正確性: {percent}%、とても良い！',
    feedback_ok: '発音の正確性: {percent}%、まずまず',
    feedback_need_improvement: '発音の正確性: {percent}%、改善が必要',
    suggestions_title_text: '提案：',
    suggestions: {
      keep_level: 'このレベルを維持しましょう！',
      clearer_pronunciation: 'より明瞭な発音を心がけましょう',
      intonation_rhythm: 'イントネーションとリズムに注意',
      listen_more: '原文を数回聞くことをおすすめします',
      mind_word_pronunciation: '注意单词的发音',
      slow_down: '可以尝试放慢语速',
      listen_before_practice: '建议先听几遍原文再练习',
      each_word_pronunciation: '注意每个单词的发音',
      practice_in_sections: '可以分段练习',
      practice_more: '多练习几次会更好',
      transcription_too_short: '转录内容较少，建议重新录音',
      transcription_incomplete: '转录内容不完整，建议重新录音',
    },
    issue_missing_chars: '遗漏字符: {items}',
    issue_missing_words: '遗漏单词: {items}',
    issue_most_missing: '大部分内容未说出',
    pronounced_as: '"{original}" 说成了 "{error}"',
    scoring_failed: '评分失败: {error}',
    unknown_error: '未知错误',
    // Guides
    guide_blind_listen_title: '如何高效盲听：',
    guide_blind_listen_tip1: '准备好后点击"下一步"，再看原文跟读',
    guide_select_words_title: '选生词 + AI 解释：',
    guide_view_translation_title: '查看翻译：',
    search_adjust_filters_hint: '试试调整筛选条件或搜索关键词',
    guide_view_translation_tip3: '理解后可返回原文再跟读一遍，强化记忆',
    record_and_score_title: '录音与评分：',
    guide_record_tip1: '对照原文逐句录音，尽量贴合节奏与停顿',
    guide_record_tip2: '录完保存后点击评分，查看整体与逐句分析',
    guide_record_tip3: '根据问题提示再次练习可显著提升分数',
    previous_words_title: '之前的生词 ({count})',
    duration_seconds: '时长: {seconds}秒',
    guide_read_text_tip1: '先快速浏览一遍原文结构与段落',
    guide_read_text_tip2: '再次播放音频，对照原文跟读（注意连读/重音）',
    guide_read_text_tip3: '跟读时轻声起步，逐步提升音量与流畅度',
    guide_select_words_tip1: '点击原文中的词语即可加入生词',
    guide_select_words_tip2: '点击"AI解释"为生词生成本地化释义与例句',
    guide_select_words_tip3: '建议聚焦于影响理解的关键词汇，避免一次选太多',
    guide_view_translation_tip1: '优先显示你的母语翻译，理解语义与细节',
    guide_view_translation_tip2: '遇到不通顺的地方，回放原文定位比对',
    // 常用动作/提示（本轮新增）
    refresh_explanation: '刷新解释',
    generating: '生成中...',
    ai_explanation_button: 'AI解释',
    ai_explanation_batch_button: '一键AI解释',
    ai_explanation_generation_progress: 'AI解释生成进度',
    translation_support_hint: '多语言翻译支持',
    translation_none_title: '暂无翻译',
    translation_none_desc: 'Translation may not be generated yet',
    translation_enable_action: '开启翻译功能',
    translation_enable_hint: '勾选上方选项以显示翻译内容',
    step_labels: {
      blind_listen: '盲听',
      read_text: '看原文+翻译',
      select_words: '选生词',
      record_scoring: '录音评分',
    },
    messages: {
      add_vocab_failed: '添加生词失败，请重试',
      batch_ai_explanation_none_success: '没有成功生成任何AI解释，请重试',
      batch_ai_explanation_failed: '批量生成AI解释失败：{error}',
      generate_explanation_failed: '生成解释失败，请重试',
      practice_completed_delayed_sync: '练习已完成，但部分数据同步可能延迟',
      confirm_delete_vocab: '确定要删除生词 "{word}" 吗？这将从生词表中永久删除。',
    },
    // 保存弹窗
    saving_modal_title: '保存中...',
    saving_modal_description: '正在保存练习数据，请稍候',
    // 功能说明
    functionality_guide:
      '📚 题目选择：支持日英中三语，L1-L5难度等级，智能筛选\n🎤 录音练习：音频播放、实时录音、发音对比\n🎯 智能评分：语音识别、5级评分体系\n📖 生词管理：拖拽选择生词，自动保存到生词本\n💾 进度跟踪：练习状态管理，支持草稿保存',
    // 分步骤引导与完成卡片
    step1_tip: 'Step 1 · 盲听：先完整听一遍，不看原文。准备好后点击"下一步"。',
    step2_tip: 'Step 2 · 看原文+翻译跟读：现在可以看原文和翻译，再听一遍并跟读。',
    step3_tip: 'Step 3 · 生词选择：开启生词模式，点击原文选取生词，并点击 AI 解释。',
    step4_tip: 'Step 4 · 录音评分：开始录音并评分，此时仅保留原文，其它模块隐藏。',
    step5_tip: 'Step 5 · 完成：练习已完成，可以查看评分结果或重新练习。',
    practice_done_title: '练习已完成',
    practice_done_desc: '成绩与生词已保存，你可以选择继续提升',
    practice_again: '再练一次',
    back_to_catalog: '返回题库',
    // 新增：警告消息
    alert_messages: {
      microphone_permission_https: '请确保您的浏览器支持HTTPS连接，否则录音功能可能无法正常工作。',
      microphone_permission_settings: '请检查您的麦克风权限设置，确保录音功能已启用。',
      audio_capture_failed: '录音过程中出现错误，请检查麦克风或网络连接。',
      speech_recognition_unavailable: '语音识别功能不可用，请检查网络连接或稍后再试。',
      browser_not_supported: '当前浏览器不支持录音功能，请使用最新版Chrome浏览器。',
      audio_timeline_not_found: '未找到音频时间线，请检查录音文件是否完整。',
      select_adjacent_segments: '请选择相邻的音频段落进行录音。',
      max_acu_blocks: '录音文件超过最大限制，请分段录音。',
      no_content: '录音文件为空，请重新录音。',
      // 新增：麦克风权限相关
      microphone_permission_denied_mobile: '您的移动设备未授权录音权限，请在设置中启用录音权限。',
      microphone_permission_denied_desktop: '您的桌面设备未授权录音权限，请在设置中启用录音权限。',
      microphone_audio_capture_error: '录音过程中出现错误，请检查麦克风或网络连接。',
      microphone_service_not_allowed: '录音服务未被允许，请检查麦克风权限设置。',
      speech_recognition_not_supported: '当前浏览器不支持语音识别功能，请使用最新版Chrome浏览器。',
      no_audio_or_timeline: '未检测到音频或音频时间线，请检查录音文件是否完整。',
      no_content_message: '录音文件为空，请重新录音。', // 新增：无内容提示消息
    },
    // 新增：ACU文本相关
    acu_text: {
      select_adjacent_units: '隣接するユニットを選択してください',
      max_5_units: '最大5つのユニットまで選択できます',
      confirm_add_to_vocab: '単語帳に追加を確認',
      cancel: 'キャンセル',
    },
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
      korean: '韓国語',
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
      review_count_all: '全部',
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
      ko: '韓国語',
    },
  },
};

// 韩语翻译（暂时使用中文翻译作为占位符，后续可完善）
const ko: Translations = zh;

// 翻译字典
export const translations: Record<Lang, Translations> = {
  zh,
  en,
  ja,
  ko,
};

// 语言显示名称
export const languageNames: Record<Lang, Record<Lang, string>> = {
  zh: { zh: '中文', en: 'English', ja: '日本語', ko: '한국어' },
  en: { zh: 'Chinese', en: 'English', ja: 'Japanese', ko: 'Korean' },
  ja: { zh: '中国語', en: '英語', ja: '日本語', ko: '韓国語' },
  ko: { zh: '중국어', en: 'English', ja: '일본어', ko: '한국어' },
};
