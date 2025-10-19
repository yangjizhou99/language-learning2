#!/usr/bin/env node

/**
 * 生成完整的中文拼音音节数据（400+条）
 * 格式：带空格（如 "guo 2"）
 */

// 完整的拼音数据（基于《汉语拼音方案》）
const pinyinData = `
a 1,a 2,a 3,a 4,ai 1,ai 2,ai 3,ai 4,an 1,an 2,an 3,an 4,ang 1,ang 2,ang 3,ang 4,ao 1,ao 2,ao 3,ao 4,
ba 1,ba 2,ba 3,ba 4,ba 5,bai 1,bai 2,bai 3,bai 4,ban 1,ban 2,ban 3,ban 4,bang 1,bang 2,bang 3,bang 4,bao 1,bao 2,bao 3,bao 4,
bei 1,bei 2,bei 3,bei 4,ben 1,ben 2,ben 3,ben 4,beng 1,beng 2,beng 3,beng 4,bi 1,bi 2,bi 3,bi 4,
bian 1,bian 2,bian 3,bian 4,biao 1,biao 2,biao 3,biao 4,bie 1,bie 2,bie 3,bie 4,
bin 1,bin 2,bin 3,bin 4,bing 1,bing 2,bing 3,bing 4,bo 1,bo 2,bo 3,bo 4,bo 5,bu 1,bu 2,bu 3,bu 4,bu 5,
pa 1,pa 2,pa 3,pa 4,pai 1,pai 2,pai 3,pai 4,pan 1,pan 2,pan 3,pan 4,pang 1,pang 2,pang 3,pang 4,pao 1,pao 2,pao 3,pao 4,
pei 1,pei 2,pei 3,pei 4,pen 1,pen 2,pen 3,pen 4,peng 1,peng 2,peng 3,peng 4,pi 1,pi 2,pi 3,pi 4,
pian 1,pian 2,pian 3,pian 4,piao 1,piao 2,piao 3,piao 4,pie 1,pie 3,pie 4,
pin 1,pin 2,pin 3,pin 4,ping 1,ping 2,ping 3,ping 4,po 1,po 2,po 3,po 4,pou 1,pou 2,pou 3,pu 1,pu 2,pu 3,pu 4,
ma 1,ma 2,ma 3,ma 4,ma 5,mai 1,mai 2,mai 3,mai 4,man 1,man 2,man 3,man 4,mang 1,mang 2,mang 3,
mao 1,mao 2,mao 3,mao 4,me 1,me 2,me 5,mei 1,mei 2,mei 3,mei 4,
men 1,men 2,men 3,men 4,men 5,meng 1,meng 2,meng 3,meng 4,mi 1,mi 2,mi 3,mi 4,
mian 1,mian 2,mian 3,mian 4,miao 1,miao 2,miao 3,miao 4,mie 1,mie 4,
min 1,min 2,min 3,min 4,ming 1,ming 2,ming 3,ming 4,miu 4,mo 1,mo 2,mo 3,mo 4,mo 5,
mou 1,mou 2,mou 3,mou 4,mu 1,mu 2,mu 3,mu 4,
fa 1,fa 2,fa 3,fa 4,fan 1,fan 2,fan 3,fan 4,fang 1,fang 2,fang 3,fang 4,
fei 1,fei 2,fei 3,fei 4,fen 1,fen 2,fen 3,fen 4,feng 1,feng 2,feng 3,feng 4,
fo 1,fo 2,fou 1,fou 2,fou 3,fu 1,fu 2,fu 3,fu 4,
da 1,da 2,da 3,da 4,dai 1,dai 2,dai 3,dai 4,dan 1,dan 2,dan 3,dan 4,dang 1,dang 2,dang 3,dang 4,
dao 1,dao 2,dao 3,dao 4,de 1,de 2,de 3,de 5,dei 3,deng 1,deng 3,deng 4,
di 1,di 2,di 3,di 4,dia 3,dian 1,dian 2,dian 3,dian 4,diao 1,diao 2,diao 3,diao 4,
die 1,die 2,die 3,ding 1,ding 2,ding 3,ding 4,diu 1,
dong 1,dong 3,dong 4,dou 1,dou 3,dou 4,du 1,du 2,du 3,du 4,
duan 1,duan 3,duan 4,dui 1,dui 3,dui 4,dun 1,dun 3,dun 4,duo 1,duo 2,duo 3,duo 4,
ta 1,ta 2,ta 3,ta 4,tai 1,tai 2,tai 3,tai 4,tan 1,tan 2,tan 3,tan 4,tang 1,tang 2,tang 3,tang 4,
tao 1,tao 2,tao 3,tao 4,te 1,te 4,teng 1,teng 2,teng 4,ti 1,ti 2,ti 3,ti 4,
tian 1,tian 2,tian 3,tian 4,tiao 1,tiao 2,tiao 3,tiao 4,tie 1,tie 3,tie 4,
ting 1,ting 2,ting 3,ting 4,tong 1,tong 2,tong 3,tong 4,tou 1,tou 2,tou 3,tou 4,
tu 1,tu 2,tu 3,tu 4,tuan 1,tuan 2,tuan 3,tuan 4,tui 1,tui 2,tui 3,tui 4,
tun 1,tun 2,tun 3,tun 4,tuo 1,tuo 2,tuo 3,tuo 4,
na 1,na 2,na 3,na 4,na 5,nai 1,nai 2,nai 3,nai 4,nan 1,nan 2,nan 3,nan 4,
nang 1,nang 2,nang 3,nang 4,nao 1,nao 2,nao 3,nao 4,ne 1,ne 4,ne 5,nei 3,nei 4,nen 4,
neng 2,neng 4,ni 1,ni 2,ni 3,ni 4,
nian 1,nian 2,nian 3,nian 4,niang 1,niang 2,niang 3,niang 4,niao 1,niao 2,niao 3,niao 4,
nie 1,nie 2,nie 3,nie 4,nin 2,ning 1,ning 2,ning 3,ning 4,niu 1,niu 2,niu 3,niu 4,
nong 1,nong 2,nong 3,nong 4,nou 4,nu 1,nu 2,nu 3,nu 4,nuan 1,nuan 3,nv 3,nv 4,
la 1,la 2,la 3,la 4,la 5,lai 1,lai 2,lai 3,lai 4,lan 1,lan 2,lan 3,lan 4,
lang 1,lang 2,lang 3,lang 4,lao 1,lao 2,lao 3,lao 4,le 1,le 4,le 5,
lei 1,lei 2,lei 3,lei 4,leng 1,leng 2,leng 3,leng 4,li 1,li 2,li 3,li 4,
lia 2,lia 3,lian 1,lian 2,lian 3,lian 4,liang 1,liang 2,liang 3,liang 4,
liao 1,liao 2,liao 3,liao 4,lie 1,lie 3,lie 4,lin 1,lin 2,lin 3,lin 4,
ling 1,ling 2,ling 3,ling 4,liu 1,liu 2,liu 3,liu 4,lo 5,
long 1,long 2,long 3,long 4,lou 1,lou 2,lou 3,lou 4,lu 1,lu 2,lu 3,lu 4,
luan 1,luan 2,luan 3,luan 4,lun 1,lun 2,lun 3,lun 4,luo 1,luo 2,luo 3,luo 4,lv 1,lv 2,lv 3,lv 4,
ga 1,ga 2,ga 3,ga 4,gai 1,gai 2,gai 3,gai 4,gan 1,gan 2,gan 3,gan 4,gang 1,gang 2,gang 3,gang 4,
gao 1,gao 2,gao 3,gao 4,ge 1,ge 2,ge 3,ge 4,ge 5,gei 3,gen 1,gen 2,gen 3,gen 4,
geng 1,geng 2,geng 3,geng 4,gong 1,gong 2,gong 3,gong 4,gou 1,gou 2,gou 3,gou 4,
gu 1,gu 2,gu 3,gu 4,gua 1,gua 2,gua 3,gua 4,guai 1,guai 2,guai 3,guai 4,
guan 1,guan 2,guan 3,guan 4,guang 1,guang 2,guang 3,guang 4,gui 1,gui 2,gui 3,gui 4,
gun 1,gun 2,gun 3,gun 4,guo 1,guo 2,guo 3,guo 4,
ka 1,ka 2,ka 3,ka 4,kai 1,kai 2,kai 3,kai 4,kan 1,kan 2,kan 3,kan 4,kang 1,kang 2,kang 3,kang 4,
kao 1,kao 2,kao 3,kao 4,ke 1,ke 2,ke 3,ke 4,ke 5,ken 1,ken 2,ken 3,ken 4,
keng 1,keng 2,keng 3,kong 1,kong 2,kong 3,kong 4,kou 1,kou 2,kou 3,kou 4,
ku 1,ku 2,ku 3,ku 4,kua 1,kua 2,kua 3,kua 4,kuai 1,kuai 2,kuai 3,kuai 4,
kuan 1,kuan 2,kuan 3,kuang 1,kuang 2,kuang 3,kuang 4,kui 1,kui 2,kui 3,kui 4,
kun 1,kun 2,kun 3,kun 4,kuo 1,kuo 2,kuo 3,kuo 4,
ha 1,ha 2,ha 3,ha 4,ha 5,hai 1,hai 2,hai 3,hai 4,han 1,han 2,han 3,han 4,hang 1,hang 2,hang 3,hang 4,
hao 1,hao 2,hao 3,hao 4,he 1,he 2,he 3,he 4,he 5,hei 1,hei 2,hei 3,hen 1,hen 2,hen 3,hen 4,
heng 1,heng 2,heng 3,heng 4,hong 1,hong 2,hong 3,hong 4,hou 1,hou 2,hou 3,hou 4,
hu 1,hu 2,hu 3,hu 4,hu 5,hua 1,hua 2,hua 3,hua 4,huai 1,huai 2,huai 3,huai 4,
huan 1,huan 2,huan 3,huan 4,huang 1,huang 2,huang 3,huang 4,hui 1,hui 2,hui 3,hui 4,hui 5,
hun 1,hun 2,hun 3,hun 4,huo 1,huo 2,huo 3,huo 4,huo 5,
ji 1,ji 2,ji 3,ji 4,ji 5,jia 1,jia 2,jia 3,jia 4,jia 5,jian 1,jian 2,jian 3,jian 4,
jiang 1,jiang 2,jiang 3,jiang 4,jiao 1,jiao 2,jiao 3,jiao 4,jiao 5,
jie 1,jie 2,jie 3,jie 4,jie 5,jin 1,jin 2,jin 3,jin 4,jing 1,jing 2,jing 3,jing 4,
jiong 1,jiong 2,jiong 3,jiong 4,jiu 1,jiu 2,jiu 3,jiu 4,ju 1,ju 2,ju 3,ju 4,ju 5,
juan 1,juan 2,juan 3,juan 4,jue 1,jue 2,jue 3,jue 4,jun 1,jun 2,jun 3,jun 4,
qi 1,qi 2,qi 3,qi 4,qi 5,qia 1,qia 2,qia 3,qia 4,qian 1,qian 2,qian 3,qian 4,
qiang 1,qiang 2,qiang 3,qiang 4,qiao 1,qiao 2,qiao 3,qiao 4,
qie 1,qie 2,qie 3,qie 4,qin 1,qin 2,qin 3,qin 4,qing 1,qing 2,qing 3,qing 4,qing 5,
qiong 1,qiong 2,qiong 3,qiu 1,qiu 2,qiu 3,qiu 4,qu 1,qu 2,qu 3,qu 4,qu 5,
quan 1,quan 2,quan 3,quan 4,que 1,que 2,que 3,que 4,qun 1,qun 2,qun 3,qun 4,
xi 1,xi 2,xi 3,xi 4,xi 5,xia 1,xia 2,xia 3,xia 4,xia 5,xian 1,xian 2,xian 3,xian 4,
xiang 1,xiang 2,xiang 3,xiang 4,xiao 1,xiao 2,xiao 3,xiao 4,xiao 5,
xie 1,xie 2,xie 3,xie 4,xie 5,xin 1,xin 2,xin 3,xin 4,xing 1,xing 2,xing 3,xing 4,xing 5,
xiong 1,xiong 2,xiong 3,xiu 1,xiu 2,xiu 3,xiu 4,xu 1,xu 2,xu 3,xu 4,xu 5,
xuan 1,xuan 2,xuan 3,xuan 4,xue 1,xue 2,xue 3,xue 4,xun 1,xun 2,xun 3,xun 4,
zhi 1,zhi 2,zhi 3,zhi 4,zhi 5,zha 1,zha 2,zha 3,zha 4,zhai 1,zhai 2,zhai 3,zhai 4,
zhan 1,zhan 2,zhan 3,zhan 4,zhang 1,zhang 2,zhang 3,zhang 4,
zhao 1,zhao 2,zhao 3,zhao 4,zhe 1,zhe 2,zhe 3,zhe 4,zhe 5,zhei 4,
zhen 1,zhen 2,zhen 3,zhen 4,zheng 1,zheng 2,zheng 3,zheng 4,zheng 5,
zhong 1,zhong 2,zhong 3,zhong 4,zhong 5,zhou 1,zhou 2,zhou 3,zhou 4,
zhu 1,zhu 2,zhu 3,zhu 4,zhu 5,zhua 1,zhua 2,zhua 3,zhuai 1,zhuai 2,zhuai 3,zhuai 4,
zhuan 1,zhuan 2,zhuan 3,zhuan 4,zhuang 1,zhuang 2,zhuang 3,zhuang 4,
zhui 1,zhui 2,zhui 3,zhui 4,zhun 1,zhun 2,zhun 3,zhun 4,zhuo 1,zhuo 2,zhuo 3,zhuo 4,
chi 1,chi 2,chi 3,chi 4,cha 1,cha 2,cha 3,cha 4,cha 5,chai 1,chai 2,chai 3,chai 4,
chan 1,chan 2,chan 3,chan 4,chang 1,chang 2,chang 3,chang 4,chang 5,
chao 1,chao 2,chao 3,chao 4,che 1,che 2,che 3,che 4,chen 1,chen 2,chen 3,chen 4,
cheng 1,cheng 2,cheng 3,cheng 4,cheng 5,chong 1,chong 2,chong 3,chong 4,
chou 1,chou 2,chou 3,chou 4,chu 1,chu 2,chu 3,chu 4,chu 5,chuai 1,chuai 2,chuai 3,chuai 4,
chuan 1,chuan 2,chuan 3,chuan 4,chuang 1,chuang 2,chuang 3,chuang 4,
chui 1,chui 2,chui 3,chui 4,chun 1,chun 2,chun 3,chun 4,chuo 1,chuo 2,chuo 3,chuo 4,
shi 1,shi 2,shi 3,shi 4,shi 5,sha 1,sha 2,sha 3,sha 4,sha 5,shai 1,shai 2,shai 3,shai 4,
shan 1,shan 2,shan 3,shan 4,shang 1,shang 2,shang 3,shang 4,shang 5,
shao 1,shao 2,shao 3,shao 4,she 1,she 2,she 3,she 4,she 5,shei 2,
shen 1,shen 2,shen 3,shen 4,shen 5,sheng 1,sheng 2,sheng 3,sheng 4,sheng 5,
shou 1,shou 2,shou 3,shou 4,shu 1,shu 2,shu 3,shu 4,shu 5,shua 1,shua 2,shua 3,shua 4,
shuai 1,shuai 2,shuai 3,shuai 4,shuan 1,shuan 2,shuan 3,shuan 4,
shuang 1,shuang 2,shuang 3,shui 1,shui 2,shui 3,shui 4,shun 1,shun 2,shun 3,shun 4,
shuo 1,shuo 2,shuo 3,shuo 4,
ri 1,ri 2,ri 3,ri 4,re 1,re 2,re 3,re 4,ren 1,ren 2,ren 3,ren 4,ren 5,
reng 1,reng 2,reng 3,rong 1,rong 2,rong 3,rong 4,rou 1,rou 2,rou 3,rou 4,
ru 1,ru 2,ru 3,ru 4,ruan 1,ruan 2,ruan 3,ruan 4,rui 1,rui 2,rui 3,rui 4,
run 1,run 2,run 3,run 4,ruo 1,ruo 2,ruo 3,ruo 4,
zi 1,zi 2,zi 3,zi 4,zi 5,za 1,za 2,za 3,za 4,zai 1,zai 2,zai 3,zai 4,
zan 1,zan 2,zan 3,zan 4,zang 1,zang 2,zang 3,zang 4,zao 1,zao 2,zao 3,zao 4,
ze 1,ze 2,ze 3,ze 4,zei 2,zen 1,zen 2,zen 3,zeng 1,zeng 2,zeng 3,zeng 4,
zha 1,zha 2,zha 3,zha 4,zhai 1,zhai 2,zhai 3,zhai 4,zhan 1,zhan 2,zhan 3,zhan 4,
zhang 1,zhang 2,zhang 3,zhang 4,zhao 1,zhao 2,zhao 3,zhao 4,
zhe 1,zhe 2,zhe 3,zhe 4,zhe 5,zhei 4,zhen 1,zhen 2,zhen 3,zhen 4,
zheng 1,zheng 2,zheng 3,zheng 4,zheng 5,zhi 1,zhi 2,zhi 3,zhi 4,zhi 5,
zhong 1,zhong 2,zhong 3,zhong 4,zhong 5,zhou 1,zhou 2,zhou 3,zhou 4,
zhu 1,zhu 2,zhu 3,zhu 4,zhu 5,zhua 1,zhua 2,zhua 3,zhuai 1,zhuai 2,zhuai 3,zhuai 4,
zhuan 1,zhuan 2,zhuan 3,zhuan 4,zhuang 1,zhuang 2,zhuang 3,zhuang 4,
zhui 1,zhui 2,zhui 3,zhui 4,zhun 1,zhun 2,zhun 3,zhun 4,zhuo 1,zhuo 2,zhuo 3,zhuo 4,
zong 1,zong 2,zong 3,zong 4,zou 1,zou 2,zou 3,zou 4,zu 1,zu 2,zu 3,zu 4,zu 5,
zuan 1,zuan 2,zuan 3,zuan 4,zui 1,zui 2,zui 3,zui 4,zun 1,zun 2,zun 3,zun 4,
zuo 1,zuo 2,zuo 3,zuo 4,zuo 5,
ci 1,ci 2,ci 3,ci 4,ca 1,ca 2,ca 3,ca 4,cai 1,cai 2,cai 3,cai 4,
can 1,can 2,can 3,can 4,cang 1,cang 2,cang 3,cang 4,cao 1,cao 2,cao 3,cao 4,
ce 1,ce 2,ce 3,ce 4,cen 1,cen 2,ceng 1,ceng 2,ceng 3,ceng 4,
cong 1,cong 2,cong 3,cong 4,cou 1,cou 2,cou 3,cou 4,cu 1,cu 2,cu 3,cu 4,
cuan 1,cuan 2,cuan 3,cuan 4,cui 1,cui 2,cui 3,cui 4,cun 1,cun 2,cun 3,cun 4,
cuo 1,cuo 2,cuo 3,cuo 4,
si 1,si 2,si 3,si 4,sa 1,sa 2,sa 3,sa 4,sai 1,sai 2,sai 3,sai 4,
san 1,san 2,san 3,san 4,sang 1,sang 2,sang 3,sang 4,sao 1,sao 2,sao 3,sao 4,
se 1,se 2,se 3,se 4,sen 1,seng 1,song 1,song 2,song 3,song 4,
sou 1,sou 2,sou 3,sou 4,su 1,su 2,su 3,su 4,suan 1,suan 2,suan 3,suan 4,
sui 1,sui 2,sui 3,sui 4,sun 1,sun 2,sun 3,sun 4,suo 1,suo 2,suo 3,suo 4,
e 1,e 2,e 3,e 4,e 5,ei 1,ei 3,ei 4,en 1,en 2,en 4,er 2,er 3,er 4,ou 1,ou 3,ou 4,
yi 1,yi 2,yi 3,yi 4,yi 5,ya 1,ya 2,ya 3,ya 4,ya 5,yan 1,yan 2,yan 3,yan 4,yan 5,
yang 1,yang 2,yang 3,yang 4,yang 5,yao 1,yao 2,yao 3,yao 4,yao 5,
ye 1,ye 2,ye 3,ye 4,ye 5,yin 1,yin 2,yin 3,yin 4,ying 1,ying 2,ying 3,ying 4,ying 5,
yo 1,yo 5,yong 1,yong 2,yong 3,yong 4,you 1,you 2,you 3,you 4,you 5,
yu 1,yu 2,yu 3,yu 4,yu 5,yuan 1,yuan 2,yuan 3,yuan 4,yue 1,yue 2,yue 3,yue 4,
yun 1,yun 2,yun 3,yun 4,
wa 1,wa 2,wa 3,wa 4,wa 5,wai 1,wai 2,wai 3,wai 4,wan 1,wan 2,wan 3,wan 4,wan 5,
wang 1,wang 2,wang 3,wang 4,wang 5,wei 1,wei 2,wei 3,wei 4,wei 5,
wen 1,wen 2,wen 3,wen 4,weng 1,weng 2,weng 3,wo 1,wo 2,wo 3,wo 4,wo 5,
wu 1,wu 2,wu 3,wu 4,wu 5
`;

// 解析拼音并生成声母、韵母
function parsePinyin(pinyin) {
  const match = pinyin.match(/^([a-z]+) ([1-5])$/);
  if (!match) return null;
  
  const [, syllable, tone] = match;
  
  // 简单规则提取声母（实际应该更复杂）
  const initials = ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w'];
  
  let shengmu = '';
  let yunmu = syllable;
  
  for (const initial of initials.sort((a, b) => b.length - a.length)) {
    if (syllable.startsWith(initial)) {
      shengmu = initial;
      yunmu = syllable.slice(initial.length);
      break;
    }
  }
  
  return { symbol: pinyin, shengmu, yunmu, tone: parseInt(tone) };
}

// 生成 SQL
const pinyins = pinyinData.trim().split(/[,\n\s]+/).filter(p => p);
const parsed = pinyins.map(parsePinyin).filter(Boolean);

console.log(`-- 完整拼音数据（${parsed.length} 条）`);
console.log(`-- 自动生成，带空格格式\n`);
console.log(`INSERT INTO public.zh_pinyin_units (symbol, shengmu, yunmu, tone) VALUES`);

const values = parsed.map(p => 
  `('${p.symbol}','${p.shengmu}','${p.yunmu}',${p.tone})`
);

console.log(values.join(',\n'));
console.log(`ON CONFLICT (symbol) DO NOTHING;`);

console.log(`\n-- 总计: ${parsed.length} 个拼音音节`);

