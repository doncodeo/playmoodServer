require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

// === CONFIG ===
const MONGODB_URI = process.env.MONGO_URI;
const CONTENT_ID = process.env.CONTENT_ID;
const COLLECTION_NAME = 'contents'; 

if (!MONGODB_URI || !CONTENT_ID) {
  console.error('Set MONGODB_URI and CONTENT_ID in .env');
  process.exit(1);
}

// === ALL TRANSLATED CAPTIONS (including German, matching your schema) ===
const translatedCaptions = [
  {
    languageCode: 'es',
    text: `Las agencias no velan por el bienestar de sus modelos, porque si lo hicieran, probablemente no ganarían tanto dinero. Soy modelo. Soy modelo. Soy modelo… [x30].  

Tienen un apartamento de dos habitaciones y dos baños con **siete personas viviendo ahí**. Cada chica pagaba 1200 dólares, siete personas. 1200 por siete… eso es un buen pellizco. Podríamos permitirnos otra habitación, ¡venga ya!  

El trabajo no tiene nada de cómodo. Todo el día tienes a varias personas tocándote la cara, el cuerpo… Recuerdo el desfile de Fendi en el que participé. El peinado de esa temporada era una especie de trenza, casi como *cornrows*. Las lágrimas me corrían por la cara porque durante **dos horas** el peluquero intentaba trenzarme el pelo. Y mi agente me dijo: «Ah, sí, no deberías haber llorado».  

Cuando un fotógrafo se acerca, te mueve como si fueras un maniquí, te levanta el brazo, te coloca la barbilla… Me parece **increíblemente insultante**, sobre todo si estás desnuda. **No me toques**.  

Creo que muchos fotógrafos hombres ascienden en su carrera porque son carismáticos o atractivos. Y aguantar conversaciones con ellos suele ser incómodo: hay coqueteo, pero también una especie de **menosprecio**.  

Era muy difícil estar en entornos donde se supone que debes be complaciente, apaciguar, agradar a idiotas que poco a poco te van quitando todo lo que valoras de ti misma más allá de… «es que siempre fui sexy de forma natural», ¿sabes? Así que me metían en sesiones cada vez más subidas de tono.  

Una amiga mayor me llevó a un set y el fotógrafo intentó ponerme en unos **bikinis diminutos** y dijo: «No pasa nada si se te sale algo». Yo le dije: «No, tengo 13 años. Esto no está bien». Era una niña, así que me sentía muy sumisa ante toda esa gente que veía como figuras de autoridad. Si me decían que hiciera algo, lo hacía. Quería hacerlo bien en esa oportunidad loca que me habían dado.  

Estaba fotografiando un catálogo y un día llegó una chica nueva. Durante el almuerzo charlábamos. Me preguntó: «Mi agencia me ha dicho si estaría dispuesta a salir con un tipo, a una cita, y me pagarían 2500 o 3000 dólares. ¿Tú haces esas cosas? Si tu agencia te lo pide, ¿es algo que deberías hacer? No quiero que se enfaden conmigo». La recuerdo tan perdida, sin saber qué hacer con todo aquello.  

Si las chicas caen en una espiral de deudas con su agencia o las empujan a la prostitución —que pasa—, puede ser durísimo. Hay muchas chicas jóvenes que acaban así.  

Había un fotógrafo con el que realmente quería trabajar. Estaba haciendo una serie de desnudos para un libro. El equipo estaba ahí: peluquería, maquillaje, vestuario… Y de repente se acercó a «arreglarme» el pelo y **intentó besarme**. Lo empujé y le dije: «¿Qué haces? Esto no me parece bien». Mi corazón latía a mil, pensando: «Tengo que salir de aquí». Cogí la bata, me la puse, me vestí y me fui.  

No puedes evitar pensar: «¿Hice algo que perpetuó esto?». En otro momento me preguntó si podíamos pasar al dormitorio, y aunque era mucho, siendo ingenua no le di demasiada importancia… hasta que **estuvo encima de mí con la cámara y sus manos en mis pechos**. De repente caí en la cuenta de que tenía que escapar. Inventé una excusa tonta de que tenía castings después y salí medio corriendo.  

Después me puso en un rodaje de tres días en Shelter Island, con pernocta. Era un trabajo grande, no podía decir que no. Y me daba una hora de llegada distinta al resto del equipo. Cuando llegaba, **solo estaba él en la habitación**. Fueron tres días esquivando balas.  

Claro que se lo conté a mi agente. Y me dijeron: «Sí, es conocido por hacer eso con las chicas».  

Si no tienes a las personas adecuadas a tu alrededor, puedes acabar en un yate con un ricachón haciendo drogas y desapareciendo, o desarrollando un trastorno alimenticio, o cayendo en las manos equivocadas.  

No creo que las niñas muy jóvenes deban firmar contratos ni explotar tan rápido. No es justo, porque te roba una parte de tu **inocencia** que nunca recuperas. Yo iba con rueditas de entrenamiento, ¿sabes? Ahora que tuve mi momento, estoy lista para correr. Y no lo habría cambiado por nada.  

[Música] [Música]`
  },
  {
    languageCode: 'fr',
    text: `Les agences ne cherchent pas l’intérêt de leurs mannequins, parce que si c’était le cas, elles gagneraient probablement moins d’argent. Je suis mannequin. Je suis mannequin. Je suis mannequin… [×30].  

Elles ont un deux-pièces, deux salles de bain, avec **sept personnes dedans**. Chaque fille payait 1200 dollars, sept personnes. 1200 × 7, ça fait un joli pactole. On aurait pu se payer une chambre de plus, franchement !  

Le métier n’a rien de confortable. Toute la journée, plusieurs personnes te touchent le visage, le corps… Je me souviens du défilé Fendi où j’ai marché. Le look cheveux de la saison, c’était une sorte de tresse, presque des *cornrows*. Les larmes coulaient sur mon visage parce que pendant **deux heures**, il essayait de me tresser les cheveux. Et mon agent : « Ah oui, tu n’aurais pas dû pleurer. »  

Quand un photographe s’approche, te manipule comme une poupée, te soulève le bras, te place le menton… Je trouve ça **extrêmement insultant**, surtout si tu es nue. **Ne me touche pas**.  

Je pense que beaucoup de photographes hommes grimpent dans leur carrière parce qu’ils sont charmeurs ou beaux. Et endurer la conversation avec eux est souvent gênant : il y a du flirt, mais aussi une forme de **mépris**.  

C’était très dur d’être dans ces environnements où il faut être accommodante, apaisante, plaire à des idiots qui te rongent petit à petit tout ce que tu valorises en toi au-delà de… « j’ai toujours été naturellement sexy ». Du coup, on me mettait dans des shootings de plus en plus sexy.  

Une amie plus âgée m’a emmenée sur un plateau, le photographe a voulu me mettre dans des **minuscules maillots** et a dit : « C’est pas grave si ça dépasse. » Moi : « Non, j’ai 13 ans, c’est pas OK. » J’étais une gamine, donc très soumise à tous ces gens vus comme des figures d’autorité. On me disait de faire quelque chose, je le faisais. Je voulais bien faire dans cette opportunité folle.  

Je shootais un catalogue, une nouvelle fille arrive. On discute à midi. Elle me demande : « Mon agence m’a demandé si je voulais sortir avec un mec, une sorte de date, ils me paieraient 2500 ou 3000 dollars. Toi tu fais ça ? Si ton agence te le demande, faut le faire ? Je veux pas qu’ils m’en veuillent. » Je me souviens d’elle, complètement perdue.  

Si les filles se retrouvent piégées dans un cycle de dettes avec leur agence ou poussées vers la prostitution — ça arrive —, c’est vraiment dur. Beaucoup de jeunes filles finissent comme ça.  

Un photographe que je voulais absolument, il faisait une série de nus pour un livre. L’équipe était là : coiffure, maquillage, vêtements… Et à un moment il s’approche pour « arranger » mes cheveux et **il essaie de m’embrasser**. Je le repousse : « Qu’est-ce que tu fais ? Ça va pas pour moi. » Mon cœur bat la chamade, je pense : faut que je sorte. J’attrape le peignoir, je me rhabille, je pars.  

Tu ne peux pas t’empêcher de penser : « Est-ce que j’ai fait quelque chose qui a encouragé ça ? » Une autre fois il demande si on peut aller dans la chambre, c’était trop, mais naïve je n’y ai pas trop prêté attention… jusqu’à ce qu’**il soit sur moi avec l’appareil et ses mains sur mes seins**. Là je réalise qu’il faut fuir. J’invente une excuse bidon de castings après et je file en courant à moitié.  

Ensuite il me booke pour trois jours de shooting avec nuitées à Shelter Island. Gros job, impossible de dire non. Il me donnait une heure d’appel différente du reste de l’équipe. Quand j’arrivais, **il était seul dans la pièce**. Trois jours à esquiver les balles.  

Bien sûr j’en ai parlé à mon agent. Réponse : « Oui, il est connu pour faire ça avec les filles. »  

Si tu n’as pas les bonnes personnes autour de toi, tu peux finir sur un yacht avec un riche, à sniffer des tonnes de coke, tomber à l’eau et mourir, ou développer un trouble alimentaire, ou tomber entre de mauvaises mains.  

Je ne crois pas qu’il faille signer des gamines ou les faire exploser si vite. Ce n’est pas juste, ça vole une partie de ton **innocence** que tu ne récupères jamais. Moi j’avais encore les petites roues, tu vois ? Maintenant que j’ai eu mon moment, je suis prête à courir. Et je n’aurais pas voulu autrement.  

[Musique] [Musique]`
  },
  {
    languageCode: 'ru',
    text: `Агентства не заботятся о благе своих моделей — если бы заботились, наверное, не зарабатывали бы столько денег. Я модель. Я модель. Я модель… [×30].  

У них квартира с двумя спальнями и двумя ванными, а там **семь человек**. Каждая девчонка платит 1200 долларов, семеро. 1200 × 7 — это приличная кучка бабла. Мы могли бы снять ещё одну комнату, ну серьёзно!  

Работа вообще не комфортная. Целый день к тебе прикасаются разные люди — лицо, тело… Помню шоу Fendi, в котором я участвовала. Причёска сезона была что-то вроде кос, почти как *cornrows*. Слёзы текли по щекам, потому что **два часа** он пытался мне заплести волосы. А мой агент: «Ага, не стоило плакать».  

Когда фотограф подходит, двигает тебя как манекен, поднимает руку, ставит подбородок… Это **чрезвычайно оскорбительно**, особенно если ты голая. **Не трогай меня**.  

Многие мужчины-фотографы поднимаются по карьерной лестнице, потому что харизматичны или красивы. И терпеть с ними разговоры часто некомфортно: там и флирт, и одновременно **принижение**.  

Было очень тяжело находиться в средах, где ты должна быть покладистой, умиротворяющей, угождать идиотам, которые понемногу отбирают у тебя всё, что ты ценишь в себе, кроме «я всегда была естественно сексуальной». Поэтому меня засовывали в всё более откровенные съёмки.  

Подруга постарше привела меня на площадку, фотограф пытался надеть на меня **крошечные купальники** и сказал: «Ничего страшного, если что-то вывалится». Я: «Нет, мне 13. Это не нормально». Я была ребёнком, поэтому полностью подчинялась всем этим «авторитетам». Скажут — сделаю. Хотела хорошо выполнить эту безумную возможность.  

Снимала каталог, пришла новенькая. За обедом болтали. Она спрашивает: «Моё агентство спросило, не хочу ли я сходить на свидание с одним парнем, заплатят 2500 или 3000 долларов. Ты такое делаешь? Если твоё агентство просит — надо соглашаться? Не хочу, чтобы они на меня злились». Помню, как она растерялась, не знала, что и думать.  

Если девчонки попадают в долговую яму к агентству или их толкают в проституцию — это случается, — бывает очень тяжело. Много молодых девушек так и заканчивают.  

Был фотограф, с которым я очень хотела работать. Он снимал серию ню для книги. Команда на месте: причёска, макияж, одежда… И вдруг он подходит «поправить» волосы и **пытается меня поцеловать**. Я оттолкнула: «Ты что делаешь? Мне это не окей». Сердце колотится, думаю: надо валить. Схватила халат, оделась, ушла.  

Невольно думаешь: «Я что-то сделала, чтобы это спровоцировать?» В другой раз он спросил, не перейти ли нам в спальню — уже перебор, но наивная я не придала значения… пока **он не оказался сверху с камерой, а руки у него на моей груди**. Тут до меня дошло, что надо бежать. Придумала дурацкую отговорку про кастинги и наполовину выскочила бегом.  

Потом он забронировал мне трёхдневную съёмку с ночёвкой на Shelter Island. Крупный заказ, нельзя было отказаться. Давал мне другое время вызова, чем остальной команде. Приезжаю — **в комнате только он один**. Три дня уворачивалась от пуль.  

Конечно, рассказала агенту. Ответ: «Да, он известен тем, что так делает с девчонками».  

Если рядом нет правильных людей, легко оказаться на яхте у какого-нибудь богача, нюхать тонны кокса, свалиться за борт и умереть, или заработать расстройство пищевого поведения, или попасть в плохие руки.  

Не верю, что таких юных девчонок надо подписывать и сразу взрывать. Это несправедливо — отнимает часть **невинности**, которую не вернуть. У меня ещё были боковые колёсики, понимаешь? Теперь, после моего момента, я готова бежать. И по-другому бы не хотела.  

[Музыка] [Музыка]`
  },
  {
    languageCode: 'zh',
    text: `机构并不真正为模特着想，因为如果他们真心为模特好，可能就赚不了那么多钱了。我是模特。我是模特。我是模特……[×30]。  

他们租了个两室两卫的公寓，**住了七个人**。每个女孩交1200美元，七个人。1200乘以7——那可是一大笔钱啊。我们明明可以再租一间卧室，来吧！  

这份工作一点都不舒服。整天都有好几个人摸你的脸、摸你的身体……我记得我走的那场Fendi秀。那季的发型好像是某种辫子，差不多像玉米辫。眼泪顺着脸往下流，因为发型师**花了两个小时**给我编辫子。然后我的经纪人说：“哦，你不该哭的。”  

当摄影师走过来、像摆弄人体模特一样摆弄你，抬起你的胳膊、调整你的下巴……我觉得这**极其侮辱人**，尤其是你还裸着的时候。**别碰我**。  

很多男摄影师能爬到高位，是因为他们有魅力或者长得好看。所以跟他们聊天经常很不舒服——有调情，但同时又有种**贬低**。  

在那种环境下真的很难，你得讨好、顺从、取悦那些一点点消磨你自我价值的白痴，除了“我天生就性感”之外……所以我就被塞进越来越性感的拍摄。  

一个年长的朋友带我去片场，摄影师想让我穿**超级小的泳装**，还说：“掉出来也没关系。”我说：“不，我才13岁，这不行。”我还是个孩子，所以对所有我视为权威的人都很顺从。别人让我做什么我就做什么。我想在这疯狂的机会里做好。  

我在拍目录时来了个新女孩。午饭时我们聊天。她问我：“我经纪公司问我愿不愿意跟一个男人约会出去，他们愿意付我2500或3000美元。你会做这种事吗？如果你的公司让你做，你应该做吗？我不想让他们生气。”我记得她特别迷茫，完全不知道怎么办。  

如果女孩陷入对经纪公司的债务循环，或者被推去卖淫——这确实发生过——会非常艰难。很多年轻女孩最后都这样。  

有一个我特别想合作的摄影师，他在为书拍一系列裸体照。团队都在：发型、化妆、服装……然后他过来“整理”我的头发，**突然想亲我**。我推开他，说：“你在干什么？这对我来说不行。”我心跳如雷，想着得赶紧离开。我抓起袍子穿上，穿好衣服就走了。  

你会忍不住想：“我是不是做了什么助长了这种事？”另一次他问能不能去卧室，虽然有点过，但当时天真没多想……直到**他趴在我身上拿着相机，手还摸我胸部**。我突然意识到得逃。我编了个有试镜的借口，半跑着离开了。  

之后他给我安排了Shelter Island三天两夜的拍摄，大工作，我拒绝不了。他给我和团队不同的报到时间。我到的时候，**房间里只有他一个人**。连续三天都在躲子弹。  

我当然告诉了经纪人。他们说：“对，他以对女孩这样出名。”  

如果你身边没有对的人，很容易就上了某个富豪的游艇、吸一堆毒品、失足落水死掉，或者得进食障碍，或者落入坏人之手。  

我不相信这么小的女孩就该签合同、一下子爆红。那不公平，因为会夺走你**永远要不回的纯真**。我当时还带着辅助轮呢。现在我有了自己的高光时刻，我准备好奔跑了。我不后悔。  

[音乐] [音乐]`
  },
  {
    languageCode: 'de',
    text: `Agenturen haben nicht das Wohl ihrer Models im Sinn – wenn sie es hätten, würden sie wahrscheinlich nicht so viel Geld verdienen. Ich bin Model. Ich bin Model. Ich bin Model… [×30].  

Sie haben eine 2-Zimmer-Wohnung mit 2 Bädern und **sieben Leuten drin**. Jede zahlt 1200 Dollar, sieben Personen. 1200 × 7 – das ist eine schöne Stange Geld. Wir hätten uns locker noch ein Zimmer leisten können, komm schon!  

Der Job ist überhaupt nicht bequem. Den ganzen Tag fassen dir mehrere Leute ins Gesicht, an den Körper… Ich erinnere mich an die Fendi-Show, in der ich gelaufen bin. Der Haarlook der Saison war so eine Art Zopf, fast wie Cornrows. Mir liefen die Tränen übers Gesicht, weil er **zwei Stunden lang** versuchte, mir die Haare zu flechten. Und meine Agentin: «Ach ja, du hättest nicht weinen sollen.»  

Wenn ein Fotograf auf dich zukommt, dich wie eine Schaufensterpuppe herumbewegt, deinen Arm hochhebt, dein Kinn zurechtrückt… Ich finde das **extrem beleidigend**, vor allem wenn du nackt bist. **Fass mich nicht an**.  

Ich glaube, viele männliche Fotografen steigen auf, weil sie charmant oder gut aussehen. Und Gespräche mit ihnen zu ertragen ist oft unangenehm – da ist Flirt, aber auch eine Art **Herabwürdigung**.  

Es war extrem schwierig, in Umfeldern zu sein, wo du gefällig, beschwichtigend, allen gefallen musst, die dir nach und nach alles nehmen, was du an dir selbst schätzt – außer vielleicht «ich war immer natürlich sexy». Deshalb wurde ich in immer sexier werdende Shootings gesteckt.  

Eine ältere Freundin nahm mich mit ans Set, der Fotograf wollte mich in **winzige Badeanzüge** stecken und sagte: «Ist okay, wenn was rausrutscht.» Ich: «Nein, ich bin 13. Das geht nicht.» Ich war ein Kind, also total unterwürfig gegenüber all diesen Autoritätsfiguren. Wenn mir jemand sagte, was ich tun soll, tat ich es. Ich wollte in dieser verrückten Chance gut sein.  

Ich drehte einen Katalog, da kam ein neues Mädchen. Beim Mittagessen quatschten wir. Sie fragte: «Meine Agentur hat gefragt, ob ich mit einem Typen ausgehen würde, sie würden mir 2500 oder 3000 Dollar zahlen. Machst du so was? Wenn deine Agentur dich fragt, solltest du das tun? Ich will nicht, dass sie sauer auf mich sind.» Ich erinnere mich, wie verloren sie war.  

Wenn Mädchen in einen Schuldenkreislauf mit ihrer Agentur geraten oder in die Prostitution gedrängt werden – das passiert –, kann es richtig hart werden. Viele junge Mädchen enden so.  

Ein Fotograf, mit dem ich unbedingt arbeiten wollte, machte eine Nacktserie für ein Buch. Team war da: Haare, Make-up, Styling… Und plötzlich kommt er, will mir die Haare «richten» und **versucht mich zu küssen**. Ich stoße ihn weg: «Was machst du? Das geht für mich nicht.» Mein Herz rast, ich denke: Ich muss hier raus. Ich schnappe den Bademantel, ziehe mich an, gehe.  

Man denkt unweigerlich: «Habe ich etwas getan, das das gefördert hat?» Ein anderes Mal fragte er, ob wir ins Schlafzimmer gehen könnten – das war schon too much, aber naiv wie ich war, dachte ich nicht weiter drüber… bis **er auf mir lag, mit der Kamera, und seine Hände an meinen Brüsten waren**. Da dämmerte es mir, dass ich abhauen muss. Ich erfand eine dumme Ausrede mit Castings danach und rannte halb raus.  

Danach buchte er mich für drei Tage Shooting mit Übernachtung auf Shelter Island. Großer Job, konnte nicht Nein sagen. Er gab mir eine andere Call-Time als dem Rest des Teams. Wenn ich kam, **war nur er allein im Raum**. Drei Tage lang Kugeln ausweichen.  

Natürlich erzählte ich es meiner Agentin. Antwort: «Ja, er ist bekannt dafür, das mit Mädchen zu machen.»  

Wenn du nicht die richtigen Leute um dich hast, landest du leicht auf einer Yacht bei irgendeinem Reichen, nimmst tonnenweise Drogen, fällst über Bord und stirbst, oder kriegst eine Essstörung, oder gerätst in die falschen Hände.  

Ich glaube nicht, dass so junge Mädchen unterschreiben oder so schnell durchstarten sollten. Das ist nicht fair, denn es raubt dir einen Teil deiner **Unschuld**, den du nie zurückbekommst. Ich hatte noch Stützräder, weißt du? Jetzt, wo ich meinen Moment hatte, bin ich bereit zu rennen. Und ich würde es nicht anders wollen.  

[Musik] [Musik]`
  }
];

// === MAIN ===
async function uploadCaptions() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const collection = db.collection(COLLECTION_NAME);

    const objectId = new ObjectId(CONTENT_ID);

    const doc = await collection.findOne({ _id: objectId });
    if (!doc) {
      console.error('Document not found:', CONTENT_ID);
      return;
    }

    const existingCodes = doc.captions?.map(c => c.languageCode) || [];
    const newCaptions = translatedCaptions.filter(
      cap => !existingCodes.includes(cap.languageCode)
    );

    if (newCaptions.length === 0) {
      console.log('All captions already exist.');
      return;
    }

    const result = await collection.updateOne(
      { _id: objectId },
      { $push: { captions: { $each: newCaptions } } }
    );

    console.log(`Added ${newCaptions.length} captions:`, newCaptions.map(c => c.languageCode).join(', '));
    console.log('Modified:', result.modifiedCount);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
  }
}

uploadCaptions();