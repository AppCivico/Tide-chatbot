require('dotenv').config();

const {
	MessengerBot, FileSessionStore, withTyping, MessengerHandler,
} = require('bottender');
const { createServer } = require('bottender/restify');
const request = require('request');
//const dialogFlow = require('apiai-promise');

const config = require('./bottender.config.js').messenger;
const FrontAPI = require('./mandatoaberto_api.js');
const opt = require('./utils/options');
const { createIssue } = require('./send_issue');
const { Sentry } = require('./utils/helper');
const googleMapsClient = require('@google/maps').createClient({
	key: process.env.GOOGLE_MAPS_API_KEY,
	Promise,
});

const mapPageToAccessToken = async (pageId) => {
	const perfilData = await FrontAPI.getPoliticianData(pageId);
	return config.accessToken;
	// return perfilData.fb_access_token ? perfilData.fb_access_token : process.env.ACCESS_TOKEN;
};

const bot = new MessengerBot({
	mapPageToAccessToken,
	appSecret: config.appSecret,
	sessionStore: new FileSessionStore(),
});

bot.setInitialState({});

bot.use(withTyping({ delay: 1000 * 2 }));

async function waitTypingEffect(context) {
	await context.typingOn();
	setTimeout(async () => {
		await context.typingOff();
	}, 2000);
}

async function getBlockFromPayload(context) {
	let payload = context.event.message.quick_reply.payload
	if (context.state.dialog !== 'Quero participar') {
		await context.setState({ dialog: payload });
	}
	return;
}

const handler = new MessengerHandler()
	.onEvent(async (context) => { // eslint-disable-line
		try {
			// console.log(await FrontAPI.getLogAction()); // print possible log actions
			if (!context.state.dialog || context.state.dialog === '' || (context.event.postback && context.event.postback.payload === 'greetings')) { // because of the message that comes from the comment private-reply
				await context.resetState();
				await context.setState({ dialog: 'greetings' });
			}
			await context.typingOn();
			if (context.event.isQuickReply && context.state.dialog !== 'recipientData') {
				await getBlockFromPayload(context)
				if (context.state.dialog.substring(0, 10) === "Qual série") {
					let splitted = context.state.dialog.split(" ");
					if (splitted[2]) {
						await context.setState({ dialog: "Qual série", subject: splitted[2] })
					}
				}
				if (context.state.dialog.substring(0, 9) === "Qual tema") {
					let splitted = context.state.dialog.split(" ");
					if (splitted[2]) {
						await context.setState({ dialog: "Qual tema", grade: splitted[2] })
					}
				}
				if (context.state.dialog.substring(0, 4) === "Téma") {
					let splitted = context.state.dialog.split(" ");
					if (splitted[1]) {
						await context.setState({ dialog: "Téma", tema: splitted[1] })
					}
				}
				if (context.state.dialog === 'Sobre Pesquisa') {
					await context.sendText(`😍\n[texto breve sobre a pesquisa e como funciona]\n\n[card com site]`);
					await waitTypingEffect(context);
					context.setState({ dialog: 'Não, voltar'})
				}
				if (context.state.dialog === 'Enviar') {
					await context.sendText(`Que legal! Vamos fazer parte dessa causa!`);
					await waitTypingEffect(context);
					context.setState({ dialog: 'Não, voltar'})
				}
			}
			else if ((context.state.dialog === 'Digitar a cidade' || context.state.dialog === 'Cidade errada') && context.event.isText) {
				let cidadeTyped = context.event.message.text;
				let result = await findCidade(cidadeTyped);
				if (result) {
					await context.setState({ dialog: "Cidade", city: result.name, state: result.state.uf, city_id: result.id })
				}
				else {
					await context.setState({ dialog: "Cidade errada" })
				}
			}
			//let user = await getUser(context)
			// we reload politicianData on every useful event
			// we update context data at every interaction that's not a comment or a post
			await context.setState({ politicianData: await FrontAPI.getPoliticianData(context.event.rawEvent.recipient.id) });
			await FrontAPI.postRecipient(context.state.politicianData.user_id, {
				fb_id: context.session.user.id,
				name: `${context.session.user.first_name} ${context.session.user.last_name}`,
				origin_dialog: 'greetings',
				picture: context.session.user.profile_pic,
				session: JSON.stringify(context.state),
			});
			if (context.event.isText) {
				await context.setState({ whatWasTyped: context.event.message.text }); // has to be set here because of talkToUs
				await createIssue(context, 'Não entendi sua mensagem pois ela é muito complexa. Você pode escrever novamente, de forma mais direta?')
			}

		// Tratando dados adicionais do recipient
		if (context.state.dialog === 'recipientData' && context.state.recipientData) {
			if (context.event.isQuickReply) {
				await context.setState({ email: context.event.message.quick_reply.payload });
			} else if (context.event.isText) {
				await context.setState({ email: context.event.message.text });
			} if (context.event.isPostback) {
				await context.setState({ email: context.event.postback.payload });
			}
		}

		if (context.state.dialog === 'recipientData' && context.state.recipientData) {
			if (context.state.recipientData === 'email') {
				await context.setState({dialog: 'waiting', time: Date.now()})
				await FrontAPI.postRecipient(context.state.politicianData.user_id, {
					fb_id: context.session.user.id,
					email: context.state.email,
					session: JSON.stringify(context.state)
				});
				await context.sendText(`Obrigada 👍\nVeja o e-mail que iremos enviar:`);
				await waitTypingEffect(context);
				await context.sendText(`[texto sobre o cenário da cidade]\n[texto sobre a pesquisa]`, { quick_replies: opt.Pressionar2 });
			}
		}

		if (context.event.message && context.event.message.attachments && context.event.message.attachments[0].type === "location") {
			let lat = context.event.message.attachments[0].payload.coordinates.lat;
			let long = context.event.message.attachments[0].payload.coordinates.long;
			try {
				let res = await googleMapsClient.reverseGeocode({
						latlng: [lat, long],
						language: 'pt-BR',
					}).asPromise()
				//console.log(context.state.mapsResults);
				if (res.status === 200) {
					let mapsResults = res.json.results;
					let city = await mapsResults.find(x => x.types.includes('administrative_area_level_2')).address_components[0].long_name;
					let result = await findCidade(city);
					if (result) {
						await context.setState({ dialog: "Cidade", city: result.name, state: result.state.uf, city_id: result.id })
					}
					else {
						await context.setState({ dialog: "Cidade errada" })
					}
				} else { // unexpected response from googlemaps api
					await context.setState( { dialog: 'Cidade errada' } );
				}
			} catch (error) {
				console.log('Error at findLocation => ', error);
				await context.setState( { dialog: 'Cidade errada' } );
			}
		}

		await context.typingOff();
		switch (context.state.dialog) {
			case 'greetings': // primeiro
				await context.sendText(`Olá, ${context.session.user.first_name}. Espero que esteja bem!\nSou _____ e estou aqui para falar sobre desigualdade educacional.`);
				await context.sendText(`Escolha uma das opções:`, { quick_replies: opt.greetings });
				break;
			case 'Minha cidade':
				await context.sendText(`Legal 😃`);
				await waitTypingEffect(context);
				await context.sendText(`Você pode enviar sua localização ou digitar o nome da cidade.`, { quick_replies: opt.MinhaCidade });
				break;
			case 'Digitar a cidade':
				await context.sendText(`Digite a cidade`);
				break;
			case 'Cidade':
				await context.sendText(`Identifiquei a cidade ${context.state.city} - ${context.state.state}. Podemos continuar?`, { quick_replies: opt.Cidade });
				break;
			case 'Qual materia?':
				await context.sendText(`Oba 😃`);
				await waitTypingEffect(context);
				await context.sendText(`Qual matéria gostaria de visualizar?`, { quick_replies: opt.QualMateria });
				break;
			case 'Cidade errada':
				await context.sendText(`Hmmm.. errei! Vamos tentar novamente?`);
				await context.sendText(`Digite a cidade`);
				break;
			case 'Sobre a pesquisa':
				await context.sendText(`😍\n[texto breve sobre a pesquisa e como funciona]`);
				await waitTypingEffect(context);
				await context.sendText(`Que tal conhecer o cenário da sua cidade sobre desigualdade na educação?`, { quick_replies: opt.SobreAPesquisa });
				break;
			case 'Qual série':
				await context.sendText(`😉\nQual série?`, { quick_replies: opt.QualSerie });
				break;
			case 'Qual tema':
				await context.sendText(`Beleza 😉`);
				await waitTypingEffect(context);
				await context.sendText(`Qual tema gostaria de visualizar?`, { quick_replies: opt.QualTema });
				break;
			case 'Téma':
				await context.sendText(`O município ${context.state.city} do estado ${context.state.state} possui o seguinte cenário:`);
				await waitTypingEffect(context);
				let result = await getResults()
				let tema = ""
				if (context.state.tema === 'racial') {
					tema = "raça";
				}
				if (context.state.tema === 'sex') {
					tema = "sexo (meninas - meninos)";
				}
				if (context.state.tema === 'nse') {
					tema = "nível socioeconômico";
				}
				if (result)
					await context.sendText(`Com relação ao ${result.subject} os alunos do ${result.school_grade}º ano estão na posição ${result.x} sobre aprendizado e posição ${result.y} sobre ${tema}.`);
				await waitTypingEffect(context);
				await context.sendText(`O que isso significa?\nA posição ideal é 0 (zero), neste cenário sua cidade está com baixo nível de aprendizado e baixo nível de desigualdade socioeconômico.\n\nMais informações:\nhttps://www.lipsum.com/`, { quick_replies: opt.result });
				break;
			case 'Pressionar':
				await context.sendText(`Quando há baixo ou médio nível de aprendizado e/ou alto ou médio nível de desigualdade, não é o cenário ideal. 😔`);
				await waitTypingEffect(context);
				await context.sendText(`Está ruim, mas vamos mudar? Você pode pressionar para a câmara da sua cidade apresentando o cenário atual e pedindo para mudar! 👊`);
				await waitTypingEffect(context);
				await context.sendText(`Eu posso te ajudar. Que tal?`, { quick_replies: opt.Pressionar });
				break;
			case 'Pressionar2':
				await context.sendText(`Bacana 😃`);
				await waitTypingEffect(context);
				try {
					await context.sendText('Por favor, compartilhe seu endereço de e-mail - você clicar no botão com um e-mail sugerido ou pode digitar manualmente.', { quick_replies: [{ content_type: 'user_email' }] });
				} catch(err) {
					await context.sendText('Por favor, compartilhe seu endereço de e-mail - você clicar no botão com um e-mail sugerido ou pode digitar manualmente.');
				}
				finally {
					await context.setState({ dialog: 'recipientData', recipientData: 'email' });
				}
				break;
			case 'Não, voltar':
				await context.sendText(`😉`);
				await waitTypingEffect(context);
				await context.sendText(`Não esqueça de compartilhar para mais pessoas conhecerem 😉`);
				await waitTypingEffect(context);
				let card = [{
					title: 'Comartilhar Assistente Digital',
					image_url: 'https://images.chatfuel.com/bot/raw/6c80a2aa-fe9a-4230-a191-037f62d195be',
					subtitle: 'Subtitle or description',
					default_action: {
						type: 'web_url',
						url: 'https://br.lipsum.com/',
						messenger_extensions: false
					},
					buttons: [{
						type: "web_url",
						url: 'https://br.lipsum.com/',
						title: 'Site da pesquisa'
					}]
				}]
				await context.sendGenericTemplate(card)
				await waitTypingEffect(context);
				await context.sendText(`Em que mais posso te ajudar?`, { quick_replies: opt.Voltar });
				break;
		} // end switch de diálogo
	} catch (err) {
		const date = new Date();
		console.log('\n');
		console.log(`Parece que aconteceu um erro as ${date.toLocaleTimeString('pt-BR')} de ${date.getDate()}/${date.getMonth() + 1} =>`);
		console.log(err);
		// if (context.event.rawEvent.field === 'feed') {
		// 	if (context.event.rawEvent.value.item === 'comment' || context.event.rawEvent.value.item === 'post') {
		// 		// we update user data at every interaction that's not a comment or a post
		// 		await context.setState({ politicianData: await FrontAPI.getPoliticianData(context.event.rawEvent.recipient.id) });
		// 		await context.setState({ pollData: await FrontAPI.getPollData(context.event.rawEvent.recipient.id) });
		// 	}
		// } else {
		await context.setState({ politicianData: await FrontAPI.getPoliticianData(context.event.rawEvent.recipient.id) });
		await context.setState({ pollData: await FrontAPI.getPollData(context.event.rawEvent.recipient.id) });
		// }

		// console.log('\n\n\n\nrawEvent.recipient.id no catch', context.event.rawEvent.recipient.id);
		// console.log('politicianData no catch', context.state.politicianData);

		await Sentry.configureScope(async (scope) => {
			if (context.session.user && context.session.user.first_name && context.session.user.last_name) {
				scope.setUser({ username: `${context.session.user.first_name} ${context.session.user.last_name}` });
				console.log(`Usuário => ${context.session.user.first_name} ${context.session.user.last_name}`);
			} else {
				scope.setUser({ username: 'no_user' });
				console.log('Usuário => Não conseguimos descobrir o nome do cidadão');
			}
			if (context.state && context.state.politicianData && context.state.politicianData.name
				&& context.state.politicianData.office && context.state.politicianData.office.name) {
				scope.setExtra('admin', `${context.state.politicianData.office.name} ${context.state.politicianData.name}`);
				console.log(`Administrador => ${context.state.politicianData.office.name} ${context.state.politicianData.name}`);
			} else {
				scope.setExtra('admin', 'no_admin');
				console.log('Administrador => Não conseguimos descobrir o nome do político');
			}

			scope.setExtra('state', context.state);
			throw err;
		});
	} // catch
		// }); // sentry context

		function getResults() {
			return new Promise(resolve => {
				let url = "https://dapitide.eokoe.com/api/data/chatbot?school_grade=" + context.state.grade + "&city_id=" + context.state.city_id + "&x=" + context.state.tema
				console.log(url);
				request(url, function (error, response, body) {
					let data = JSON.parse(body);
					let filtered = data.data.filter(element => {
			      return element.subject === context.state.subject
			    })
					resolve(filtered[0])
					return filtered[0];
			  })
			})
		}

		function findCidade(name) {
			return new Promise(resolve => {
				request('https://dapitide.eokoe.com/api/cities', function (error, response, body) {
					let data = JSON.parse(body);
					name = name.replace(/[\s]/g, '-')
			    let highScore = {
			      city: '',
			      score: 0
			    }
			    for (let city of data.cities) {
			      let score = similarity(name, city.name)
			      if (score > highScore.score) {
			        highScore = {
			          city: city,
			          score: score
			        }
			      }
			    }
			    if (highScore.score >= 0.70) {
						resolve(highScore.city);
			      return highScore.city;
			    }
			    else {
						resolve(null)
			      return null;
			    }
			  })
			})
		}

		function similarity(s1, s2) {
		  var longer = s1;
		  var shorter = s2;
		  if (s1.length < s2.length) {
		    longer = s2;
		    shorter = s1;
		  }
		  var longerLength = longer.length;
		  if (longerLength == 0) {
		    return 1.0;
		  }
		  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
		}

		function editDistance(s1, s2) {
		  let translate = {"ã":"a", "â":"a", "á":"a", "é":"e", "è":"e", "ê":"e", "í":"i", "ç":"c", "õ":"o", "ú":"u"}
		  s1 = s1.toLowerCase().replace(/[ãâáéèêíçõú]/g, function(match) {
		    return translate[match];
		  });
		  s2 = s2.toLowerCase().replace(/[ãâáéèêíçõú]/g, function(match) {
		    return translate[match];
		  });
		  let costs = new Array();
		  for (var i = 0; i <= s1.length; i++) {
		    let lastValue = i;
		    for (var j = 0; j <= s2.length; j++) {
		      if (i == 0)
		        costs[j] = j;
		      else {
		        if (j > 0) {
		          let newValue = costs[j - 1];
		          if (s1.charAt(i - 1) != s2.charAt(j - 1))
		            newValue = Math.min(Math.min(newValue, lastValue),
		              costs[j]) + 1;
		          costs[j - 1] = lastValue;
		          lastValue = newValue;
		        }
		      }
		    }
		    if (i > 0)
		      costs[s2.length] = lastValue;
		  }
		  return costs[s2.length];
		}
}); // function handler


bot.onEvent(handler);

const server = createServer(bot, { verifyToken: config.verifyToken });


server.listen(process.env.API_PORT, () => {
	console.log(`Server is running on ${process.env.API_PORT} port...`);
});
