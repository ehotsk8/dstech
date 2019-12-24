const dependency = [
    'DS/i3DXCompassPlatformServices/i3DXCompassPlatformServices',
    'DS/UIKIT/Input/Button',
    'DS/UIKIT/Input/Text',
    'DS/UIKIT/Input/Select',
    'DS/UIKIT/Input/File',
    'DS/UIKIT/Scroller',
    'DS/UIKIT/Alert',
    'DS/UIKIT/Carousel',
    'DS/WAFData/WAFData',
    'DS/UIKIT/Mask'
];

function executeWidgetCode(widget) {
    'use strict';
    console.log(widget)
    
    require(dependency, function(
        i3DXCompassPlatformServices,
        Button, Text, Select, File,
        Scroller, Alert, Carousel,
        WAFData, Mask
    ) {
        function createSwymPost(infos, content) {

            function getToken(cb) {
                const tokenPath = widget.swymURL + '/api/index/tk'
                const addPostRequest = {
                    method: 'GET',
                    async: true,
                    onComplete: (response, headers, xhr) => {
                        const result = JSON.parse(response).result;
                        cb(result.ServerToken);
                    },
                    onFailure: (e) => {
                        console.log('Error: ' + e);
                        widget.notificationElement.add({
                            className: 'error',
                            message: 'Ошибка при создании вопроса в 3DSwym'
                        });
                        Mask.unmask(widget.body)
                    }
                }
                WAFData.authenticatedRequest(tokenPath, addPostRequest);
            }

            function addMedias(token, cb) {
                const communityId = widget.getValue('COMMUNITY_ID');

                const mediaAddUrl = widget.swymURL + '/api/media/add';

                const mediaFiles = infos.find(f => f.key === 'media').value.elements.input.files;
                const links = [];
                
                function addMedia(file) {
                	 const formData = new FormData();
                     formData.append('community_id', communityId);
                     formData.append('published', '0');
                     formData.append('is_illustration', '1');
                     formData.append('filename', file.name);
                     formData.append('userFile', file);
                     	
                     const addMediaRequest = {
                         method: 'POST',
                         async: true,
                         data: formData,
                         headers: {
                             'X-DS-SWYM-CSRFTOKEN': token
                         },
                         onComplete: (response, headers, xhr) => {
                         	widget.notificationElement.add({
                                  className: 'success',
                                  message: 'Медиа успешно загружены в 3DSwym'
                            });
                         	const responseJson = JSON.parse(response);
                         	
                         	links.push(`<img data-source="swym" data-community-id="${communityId}" data-media-id="${responseJson.result.id_media}" data-media-type="${responseJson.result.media_type}" data-position="center" >`);
                         	
                         	if(links.length === mediaFiles.length)
                         		cb(links)
                         },
                         onFailure: (e) => {
                             console.log('Error: ' + e);
                             widget.notificationElement.add({
                                 className: 'error',
                                 message: 'Ошибка при загрузке медиа в 3DSwym'
                             });
                             Mask.unmask(widget.body)
                         }
                     }
                     WAFData.authenticatedRequest(mediaAddUrl, addMediaRequest);
                }
                
                Array.from(mediaFiles).forEach(f => addMedia(f));
            }

            function createPost(token, title, question, cb) {
                const createPostUrl = widget.swymURL + '/api/question/add';
                const body = {
                    params: {
                        community_id: widget.getValue('COMMUNITY_ID'),
                        published: 1,
                        contentType: "iquestion",
                        question: question,
                        title: title,
                        withThumbnailsInfo: true
                    }
                };
                const addPostRequest = {
                    method: 'POST',
                    async: true,
                    data: JSON.stringify(body),
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'X-DS-SWYM-CSRFTOKEN': token
                    },
                    onComplete: (response, headers, xhr) => {
                        widget.notificationElement.add({
                            className: 'success',
                            message: 'Вопрос успешно создан'
                        });

                        const result = JSON.parse(response).result;

                        let postLink = widget.swymURL + '/%23community:' + result._community.id + '/iquestion:' + result.id;;
                        const user = result.author.first_name + ' ' + result.author.last_name;
                        cb(user, postLink);
                        
                        widget.postLinkHTML = widget.swymURL + '/#community:' + result._community.id + '/iquestion:' + result.id;;
                        
                        Mask.unmask(widget.body);
                        
                        if(widget.postLinkHTML)
                        	widget.openLinkButton.show();
                    },
                    onFailure: (e) => {
                        console.log('Error: ' + e);
                        widget.notificationElement.add({
                            className: 'error',
                            message: 'Ошибка при создании вопроса в 3DSwym'
                        });
                        Mask.unmask(widget.body)
                    }
                }
                WAFData.authenticatedRequest(createPostUrl, addPostRequest);
            }

            const title = infos.find(f => f.key === 'title').value;
            let question = content.outerHTML;

            getToken((token) => {
            	addMedias(token, (links) => {
                    links.forEach(f => {
                    	question += f;
                    });
                    createPost(token, title, question, (fromUser, postUrl) => {
                        const message = `Вопрос: <b>${encodeURI(title)}</b>%0AОт: <strong>${encodeURI(fromUser)}</strong>%0A<a href="${postUrl}">Ссылка на пост</a>`;
                        sendTelegramMessage(message);
                    })
                })
            })
        }

        function sendTelegramMessage(text) {

            const botApi = 'https://api.telegram.org';
            const telegaBotPath = `${botApi}/bot902867180:AAGmQpj7CVmycg8-4XOk2IqexHaXdF3fl0o/sendMessage?chat_id=${widget.getValue('CHANNEL')}&parse_mode=HTML&text=${text}`;

            let xhr = new XMLHttpRequest();
            xhr.open('GET', telegaBotPath);
            xhr.send();
            xhr.onload = function() {

                if (xhr.status != 200) {
                    widget.notificationElement.add({
                        className: 'error',
                        message: 'Ошибка уведомления в Telegram'
                    });
                    Mask.unmask(widget.body)
                } else {
                    widget.notificationElement.add({
                        className: 'success',
                        message: 'Уведомление в Telegram выполнено успешно'
                    });
                }
            };
        }

        function onInputChange(e) {
            setTimeout(() => {
                const value = e.target.value;
                e.target.setStyles({
                    border: value.length > 0 ? null : '2px dashed #ea4f37'
                });
            }, 10);
        }

        function getInput(field) {
            switch (field.type) {
                case 'text':
                    const hasMultiline = field.multiline ? true : false;
                    const textElement = new Text({
                        placeholder: 'Введите значение...',
                        multiline: hasMultiline,
                        rows: 5,
                        events: {
                            onKeyDown: onInputChange,
                            onChange: onInputChange,
                        }
                    });
                    textElement.getContent().setStyles({
                        maxWidth: '100%',
                        minWidth: '100%'
                    });
                    return textElement;
                case 'select':
                    const selectElement = new Select({
                        isRequired: field.isRequired,
                        custom: false,
                        placeholder: 'Выберите значение...',
                        options: field.options,
                        events: {
                            onChange: onInputChange,
                        }
                    });
                    return selectElement;
                case 'file':
                    return new File({
                        multiple: true,
                        buttonBefore: false,
                        name: 'file-input',
                        buttonClassName: 'primary',
                        placeholder: 'Файлы...',
                        buttonText: 'Выберите файлы'
                    });
            }
        }

        function getField(field) {
            const titleElements = [field.title];
            if (field.isRequired)
                titleElements.push('<span style="color: #db4437;"> *</span>');
            const input = getInput(field);
            const element = UWA.createElement('div', {
                'class': 'card',
                html: [{
                    tag: 'div',
                    'class': 'card-block',
                    html: {
                        tag: 'h4',
                        styles: {
                            paddingLeft: '5px'
                        },
                        html: titleElements
                    }
                }, {
                    tag: 'div',
                    'class': 'card-footer',
                    html: input
                }]
            });
            return { element: element, field: field, input: input };
        }

        function checkFields(fields) {
            let isOk = true;
            fields.forEach(f => {
                if (f.field.isRequired) {
                    let value = f.input.getValue();
                    value = value instanceof Array ? value[0] : value;
                    f.input.elements.input.setStyles({
                        border: value.length > 0 ? null : '2px dashed #ea4f37'
                    });

                    if (value.length === 0 && isOk)
                        isOk = false;
                }
            });
            return isOk;
        }

        function onLoad() {
            const title = "Форма обращения за поддержкой в департамент DS Russia TechSales";
            widget.setTitle(title);

            const fields = form.map(f => getField(f));
            let secondFields = undefined;

            function onBackClick() {
                const isLastSlide = carousel.current.id === 'slide-3';
                widget.openLinkButton.hide();

                if (isLastSlide) {
                    carousel.slide(0);
                    setTimeout(() => {
                        previousButton.hide();
                        nextButton.setValue('Продолжить');
                        nextButton.show();
                        requiredMsgElement.show();
                    }, 800);
                } else {
                    nextButton.setValue('Продолжить');
                    nextButton.setClassName('primary');
                    previousButton.hide();
                    nextButton.enable();
                    carousel.slide('left');
                }
            }

            function onNextClick() {
                const isFirstSlide = carousel.current.id === 'slide-1';
                const isOk = checkFields(isFirstSlide ? fields : secondFields);

                const requestTypeField = fields.find(f => f.field.key == 'request_type');
                const requestClassificatorField = fields.find(f => f.field.key == 'request_classificator');

                if (isFirstSlide && isOk) {
                    const typeValue = requestTypeField.input.getValue()[0];

                    const secondFieldsInfo = requestTypeField.field.options[typeValue].fields;
                    secondFields = secondFieldsInfo.map(f => getField(f));

                    secondSlideElement.setHTML(secondFields.map(f => f.element));
                    carousel.slide();

                    nextButton.setValue('Отправить вопрос');
                    previousButton.show();
                } else if (isOk) {
                    Mask.mask(widget.body, 'Пожалуйста, подождите...')

                    const infoElements = [];
                    const infos = [];

                    function addInfoElement(title, value, key) {
                        value = value instanceof Array ? value[0] : value;
                        if (value === '' || key === 'media' )
                            return;

                        infos.push({ value: value, title: title, key: key });
                        infoElements.push(
                            UWA.createElement('p', {
                                styles: {
                                    margin: '5px 0'
                                },
                                html: [{
                                    tag: 'strong',
                                    styles: {
                                        fontWeight: 'bold'
                                    },
                                    text: title + ': '
                                }, {
                                    tag: 'span',
                                    text: value
                                }]
                            })
                        )
                    }
                    const typeValue = requestTypeField.field.options[requestTypeField.input.getValue()].label;
                    addInfoElement(requestTypeField.field.title, typeValue, requestTypeField.field.key);
                    addInfoElement(requestClassificatorField.field.title, requestClassificatorField.input.getValue(), requestClassificatorField.field.key)
                    secondFields.forEach(f => {
                        let value = f.input.getValue();
                        addInfoElement(f.field.title, value, f.field.key);
                    })
                    const content = UWA.createElement('div', { html: infoElements });
                    lastSlideElement.setHTML(content);

                    requiredMsgElement.hide();
                    carousel.slide();

                    nextButton.hide();
                    previousButton.setValue('В начало');

                    const media = secondFields.find(f => f.field.key === 'media');
                    infos.push({ value: media.input, title: media.field.title, key: 'media' });
                    createSwymPost(infos, content);
                } else {
                    widget.notificationElement.add({
                        className: 'error',
                        message: 'Заполните обязательные поля'
                    });
                }
            }

            const previousButton = new Button({ value: 'Назад', className: 'default' }).hide();
            previousButton.addEvent('onClick', onBackClick);

            const nextButton = new Button({ value: 'Продолжить', className: 'primary' });
            nextButton.getContent().style.marginLeft = '10px';
            nextButton.addEvent('onClick', onNextClick);
            
            const openLinkButton = new Button({ value: 'Ссылка на пост', className: 'success active' });
            openLinkButton.getContent().style.marginLeft = '10px';
            openLinkButton.addEvent('onClick', () => { 
            	if(widget.postLinkHTML)
            		window.open(widget.postLinkHTML, '_blank');
            	widget.postLinkHTML = undefined;
            }); 
            widget.openLinkButton = openLinkButton;
            openLinkButton.hide();
            
            const carousel = new Carousel({
                arrows: false,
                autoPlay: false,
                animation: 'slide',
                dots: false,
                infinite: false
            });
            carousel.getContent().setStyles({
                marginRight: '15px'
            });

            const firstSlideElement = UWA.createElement('div', {
                id: 'slide-1',
                html: [...fields.map(f => f.element)]
            });
            const secondSlideElement = UWA.createElement('div', { id: 'slide-2' });
            const lastSlideElement = UWA.createElement('div', { id: 'slide-3' });

            carousel.add([firstSlideElement, secondSlideElement, lastSlideElement]);

            const requiredMsgElement = UWA.createElement('div', {
                styles: {
                    color: '#db4437',
                    fontSize: '10px'
                },
                text: '* Обязательно для заполнения'
            });
            const contentScroller = new Scroller({
                element: UWA.createElement('div', {
                    styles: {
                        height: 'calc(100% - 170px)'
                    },
                    html: [carousel, requiredMsgElement]
                })
            });
            const formElement = UWA.createElement('div', {
                html: {
                    tag: 'div',
                    styles: {
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'whitesmoke'
                    },
                    html: {
                        tag: 'div',
                        styles: {
                            position: 'relative',
                            height: '100%',
                            padding: '0px 10px 0 25px',
                        },
                        html: [{
                                tag: 'h3',
                                text: title,
                                styles: {
                                    color: '#005686',
                                    padding: '8px 0'
                                }
                            },
                            contentScroller,
                            {
                                tag: 'div',
                                styles: {
                                    margin: '20px 15px',
                                    textAlign: 'center'
                                },
                                html: [
                                    previousButton,
                                    nextButton,
                                    openLinkButton
                                ]
                            }
                        ]
                    }
                }
            });

            widget.setBody(formElement);

            widget.notificationElement = new Alert({
                visible: true,
                autoHide: true,
                fullWidth: true,
                hideDelay: 2000
            }).inject(widget.body);
            widget.notificationElement.elements.container.setStyles({
                position: 'absolute',
                left: '0',
                top: '0',
                right: '0'
            });
        };

        i3DXCompassPlatformServices.getPlatformServices({
            onComplete: function onComplete(e) {
				console.log(e);
                widget.swymURL = e[0]['3DSwym'];

                widget.addEvents({
                    onLoad: onLoad,
                    onRefresh: onLoad,
                    onResize: function onResize() {}
                });
            },
            onFailure: function onFailure(e) {
                console.error(e);
            }
        });
        widget.setAutoRefresh(-1);
    });
}

const commonFields = [{
    key: 'title',
    isRequired: true,
    title: 'Краткая формулировка запроса',
    type: 'text'
}, {
    isRequired: true,
    title: 'Детальное описание запроса, какая помощь необходима',
    multiline: true,
    type: 'text'
}, {
    key: 'media',
    title: 'Загрузите сопроводительные файлы (pdf, pptx, docx, xlsx, jpg, jpeg, png)',
    type: 'file'
}];

const secondaryFields = [
    ...commonFields,
    {
        isRequired: true,
        title: 'Выберите тип продукта',
        type: 'select',
        options: [
            { value: '3DEXPERIENCE Platform (любой сервис, продукт или приложение на Платформе)' },
            { value: 'Брендовый продукт' },
            { value: 'Другое (сторонний продукт, обеспечивающий работу продуктов DS)' }
        ]
    }, {
        isRequired: true,
        title: 'Версия и релиз',
        type: 'text'
    }, {
        isRequired: true,
        title: 'Уровень обновления',
        type: 'text'
    }, {
        isRequired: true,
        title: 'Имя приложение (App), технического продукта',
        type: 'text'
    }, {
        title: 'Тип приложения',
        type: 'select',
        options: [
            { value: 'Настольное' },
            { value: 'Веб-приложение' },
            { value: 'Сервис 3DEXPERIENCE Platform' }
        ]
    }, {
        title: 'Лицензия или Роль',
        type: 'text'
    }
]

const form = [{
    key: 'request_classificator',
    isRequired: true,
    type: 'select',
    title: 'Классификатор запроса',
    description: 'Укажите в каком контексте происходит обращение за технической поддержкой, это позволит определить приоритетность вашего запроса',
    options: [
        { value: 'Помощь в пресейле (есть Oppty) (Высокий приоритет)' },
        { value: 'Помощь в пресейле (нет Oppty)' },
        { value: 'Техническая поддержка заказчика (Service Request зарегистрирован) (Высокий приоритет)' },
        { value: 'Техническая поддержка заказчика (Service Request не зарегистрирован)' },
        { value: 'Сервисные работы у заказчика' },
        { value: 'Самообразование и повышение квалификации' }
    ]
}, {
    key: 'request_type',
    isRequired: true,
    type: 'select',
    title: 'Тип запроса',
    description: 'Выберите тип запроса на техническую поддержку со стороны департамента DS Russia TechSales',
    options: [{
        value: 1,
        label: 'Технический вопрос по работе сервиса, приложения или продукта',
        description: 'Вопросы связанные с документированной функциональностью продукта, заложенными в него бизнес-процессами, методологией работы, лицензированием и пакетированием',
        fields: secondaryFields
    }, {
        value: 2,
        label: 'Проблема с установкой, работой, настройкой и доработкой сервиса, приложения или продукта',
        description: 'Вопросы связанные с багами, ошибками при установке и работе продуктов DS, а так же их настройкой и доработкой',
        fields: [
            ...secondaryFields,
            {
                title: 'Номер Service Request (если есть)',
                type: 'text'
            }, {
                isRequired: true,
                title: 'Стек установки всего окружения',
                multiline: true,
                type: 'text'
            }
        ]
    }, {
        value: 3,
        label: 'Запрос на предоставление материалов по продуктам (Бренды), Индустриальным Решениям, Дистрибутивов и Пакетов Обновлений',
        description: 'Мне необходимы сейловые, технические, маркетинговые материалы по продуктам и индустриальным решениям DS, а так же дистрибутивы ПО и пакеты обновлений',
        fields: [
            ...commonFields,
            {
                isRequired: true,
                title: 'Категория материалов',
                type: 'select',
                options: [
                    { value: 'Брендовые' },
                    { value: 'Индустриальные' },
                    { value: 'Дистрибутивы ПО, пакеты обновлений' }
                ]
            }, {
                isRequired: true,
                title: 'Тип необходимых материалов',
                type: 'select',
                options: [
                    { value: 'Материалы для продавцов (обзорные материалы, SWOT-анализ, пакетирование)' },
                    { value: 'Технические материалы по продукту (функциональная презентация, видеоролик)' },
                    { value: 'Маркетинговые материалы (референсы, история успеха)' }
                ]
            }
        ]
    }, {
        value: 4,
        label: 'Обучение и сертификация',
        description: 'Вопросы связанные с прохождением обучения на 3DEXPERIENCE University, 3DS Companion, доступности обучающих материалов, сертификационных программ, сдачи сертификационных экзаменов',
        fields: [
            ...commonFields,
            {
                isRequired: true,
                title: 'Запрос касается',
                type: 'select',
                options: [
                    { value: '3DEXPERIENCE University' },
                    { value: '3DS Companion Learning Space' },
                    { value: 'Сертификация и сдача экзаменов' }
                ]
            }
        ]
    }, {
        value: 5,
        label: 'Другое',
        description: 'Если ваш запрос не попадает ни в одну из перечисленных выше категорий, то вы можете обратиться за помощью в произвольной форме',
        fields: commonFields
    }]
}];