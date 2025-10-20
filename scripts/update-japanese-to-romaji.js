// 更新unit_catalog表为训令式罗马字
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// 完整的训令式罗马字音节列表
const romajiSyllables = [
  // 基本音节（46个）
  'a', 'i', 'u', 'e', 'o',
  'ka', 'ki', 'ku', 'ke', 'ko',
  'sa', 'si', 'su', 'se', 'so',
  'ta', 'ti', 'tu', 'te', 'to',
  'na', 'ni', 'nu', 'ne', 'no',
  'ha', 'hi', 'hu', 'he', 'ho',
  'ma', 'mi', 'mu', 'me', 'mo',
  'ya', 'yu', 'yo',
  'ra', 'ri', 'ru', 're', 'ro',
  'wa', 'wo', 'n',
  
  // 浊音（20个）
  'ga', 'gi', 'gu', 'ge', 'go',
  'za', 'zi', 'zu', 'ze', 'zo',
  'da', 'di', 'du', 'de', 'do',
  'ba', 'bi', 'bu', 'be', 'bo',
  
  // 半浊音（5个）
  'pa', 'pi', 'pu', 'pe', 'po',
  
  // 拗音（21个）
  'kya', 'kyu', 'kyo',
  'sya', 'syu', 'syo',
  'tya', 'tyu', 'tyo',
  'nya', 'nyu', 'nyo',
  'hya', 'hyu', 'hyo',
  'mya', 'myu', 'myo',
  'rya', 'ryu', 'ryo',
  
  // 浊音拗音（12个）
  'gya', 'gyu', 'gyo',
  'zya', 'zyu', 'zyo',
  'bya', 'byu', 'byo',
  'pya', 'pyu', 'pyo'
];

async function updateJapaneseToRomaji() {
  console.log('🔧 开始更新unit_catalog表为训令式罗马字...\n');
  
  try {
    // 1. 删除现有的日文音素数据
    console.log('🗑️ 删除现有的日文音素数据...');
    const { error: deleteError } = await supabaseAdmin
      .from('unit_catalog')
      .delete()
      .eq('lang', 'ja-JP');
    
    if (deleteError) {
      console.error('❌ 删除现有数据失败:', deleteError);
      return;
    }
    
    console.log('✅ 成功删除现有日文音素数据');
    
    // 2. 插入训令式罗马字音节数据
    console.log('\n📝 插入训令式罗马字音节数据...');
    
    const insertData = romajiSyllables.map((syllable, index) => ({
      unit_id: (1267 + index).toString(),
      symbol: syllable,
      unit_type: 'phoneme',
      lang: 'ja-JP',
      created_at: new Date().toISOString()
    }));
    
    const { error: insertError } = await supabaseAdmin
      .from('unit_catalog')
      .insert(insertData);
    
    if (insertError) {
      console.error('❌ 插入新数据失败:', insertError);
      return;
    }
    
    console.log(`✅ 成功插入 ${insertData.length} 个训令式罗马字音节`);
    
    // 3. 验证插入的数据
    console.log('\n🔍 验证插入的数据...');
    const { data: verifyData, error: verifyError } = await supabaseAdmin
      .from('unit_catalog')
      .select('*')
      .eq('lang', 'ja-JP')
      .order('unit_id');
    
    if (verifyError) {
      console.error('❌ 验证数据失败:', verifyError);
      return;
    }
    
    console.log(`✅ 验证成功，共 ${verifyData.length} 个罗马字音节`);
    
    // 4. 显示修复后的数据分类
    console.log('\n📊 罗马字音节分类统计:');
    
    const basicSyllables = verifyData.filter(item => 
      ['a', 'i', 'u', 'e', 'o', 'ka', 'ki', 'ku', 'ke', 'ko', 'sa', 'si', 'su', 'se', 'so', 
       'ta', 'ti', 'tu', 'te', 'to', 'na', 'ni', 'nu', 'ne', 'no', 'ha', 'hi', 'hu', 'he', 'ho',
       'ma', 'mi', 'mu', 'me', 'mo', 'ya', 'yu', 'yo', 'ra', 'ri', 'ru', 're', 'ro', 'wa', 'wo', 'n']
      .includes(item.symbol)
    );
    
    const voicedSyllables = verifyData.filter(item => 
      ['ga', 'gi', 'gu', 'ge', 'go', 'za', 'zi', 'zu', 'ze', 'zo', 'da', 'di', 'du', 'de', 'do', 
       'ba', 'bi', 'bu', 'be', 'bo'].includes(item.symbol)
    );
    
    const semiVoicedSyllables = verifyData.filter(item => 
      ['pa', 'pi', 'pu', 'pe', 'po'].includes(item.symbol)
    );
    
    const yoonSyllables = verifyData.filter(item => 
      ['kya', 'kyu', 'kyo', 'sya', 'syu', 'syo', 'tya', 'tyu', 'tyo', 'nya', 'nyu', 'nyo',
       'hya', 'hyu', 'hyo', 'mya', 'myu', 'myo', 'rya', 'ryu', 'ryo', 'gya', 'gyu', 'gyo',
       'zya', 'zyu', 'zyo', 'bya', 'byu', 'byo', 'pya', 'pyu', 'pyo'].includes(item.symbol)
    );
    
    console.log(`   基本音节: ${basicSyllables.length} 个`);
    console.log(`   浊音: ${voicedSyllables.length} 个`);
    console.log(`   半浊音: ${semiVoicedSyllables.length} 个`);
    console.log(`   拗音: ${yoonSyllables.length} 个`);
    console.log(`   总计: ${verifyData.length} 个音节`);
    
    console.log('\n🎉 unit_catalog表训令式罗马字更新完成！');
    
  } catch (error) {
    console.error('❌ 更新过程中发生错误:', error);
  }
}

// 运行更新
updateJapaneseToRomaji();

