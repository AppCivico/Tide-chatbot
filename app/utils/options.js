module.exports = {
	greetings: [
		{ title: 'Minha cidade', content_type: 'text', payload: 'Minha cidade' },
		{ title: 'Sobre a pesquisa', content_type: 'text', payload: 'Sobre a pesquisa' }
	],
	MinhaCidade: [
		{ content_type: 'location' },
		{ title: 'Digitar a cidade', content_type: 'text', payload: 'Digitar a cidade' }
	],
	Cidade: [
		{ title: 'Continuar', content_type: 'text', payload: 'Qual materia?' },
		{ title: 'Cidade errada', content_type: 'text', payload: 'Cidade errada' }
	],
	SobreAPesquisa: [
		{ title: 'Pesquisar', content_type: 'text', payload: 'Minha cidade' }
	],
	QualMateria: [
		{ title: 'Português', content_type: 'text', payload: 'Qual série Português' },
		{ title: 'Matemática', content_type: 'text', payload: 'Qual série Matemática' }
	],
	QualSerie: [
		{ title: '5º (quinto) ano', content_type: 'text', payload: 'Qual tema 5' },
		{ title: '9º (nono) ano', content_type: 'text', payload: 'Qual tema 9' }
	],
	QualTema: [
		{ title: 'Raça', content_type: 'text', payload: 'Téma racial' },
		{ title: 'Nível Socioeconômico', content_type: 'text', payload: 'Téma nse' },
		{ title: 'Sexo', content_type: 'text', payload: 'Téma sex' }
	],
	Voltar: [
		{ title: 'Trocar tema', content_type: 'text', payload: 'Qual tema' },
		{ title: 'Trocar série', content_type: 'text', payload: 'Qual série' },
		{ title: 'Trocar matéria', content_type: 'text', payload: 'Qual materia?' },
		{ title: 'Ver outra cidade', content_type: 'text', payload: 'Minha cidade' },
		{ title: 'Sobre a pesquisa', content_type: 'text', payload: 'Sobre Pesquisa' }
	],
	result: [
		{ title: 'Entendi', content_type: 'text', payload: 'Pressionar' }
	],
	Pressionar: [
		{ title: 'Pressionar', content_type: 'text', payload: 'Pressionar2' },
		{ title: 'Não, voltar', content_type: 'text', payload: 'Não, voltar' }
	],
	Pressionar2: [
		{ title: 'Enviar', content_type: 'text', payload: 'Enviar' },
		{ title: 'Cancelar', content_type: 'text', payload: 'Não, voltar' }
	]
};
