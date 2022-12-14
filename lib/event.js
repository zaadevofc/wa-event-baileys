module.exports = (scope) => {
    const {
        generateForwardMessageContent,
        prepareWAMessageMedia,
        generateWAMessageFromContent,
        downloadContentFromMessage,
        jidDecode,
        makeInMemoryStore,
        proto
    } = require("@adiwajshing/baileys")
    const fs = require('fs')
    const FileType = require('file-type')
    const path = require('path')
    const axios = require('axios')
    const PhoneNumber = require('awesome-phonenumber')
    const {
        imageToWebp,
        videoToWebp,
        writeExifImg,
        writeExifVid,
        getBuffer,
        getSizeMedia,
        await,
        sleep
    } = require('./function')

    const pino = require('pino')
    const store = makeInMemoryStore({
        logger: pino().child({
            level: 'silent', stream: 'store'
        })
    })
    
    scope.sendReaction = (emoji = '⁉️', m) => {
            const reactionMessage = {
                react: {
                    text: emoji,
                    key: m.key
                }
            }
            return scope.sendMessage(m.chat, reactionMessage)
        }

    scope.sendButtonMsg = (text = '', button = [], options = {
        from: '', footer: 'dev: @zaadevofc'
    }) => {
        return scope.sendMessage(options?.from, {
            text,
            viewOnce: true,
            templateButtons: button,
            footer: options.footer,
            contextInfo: {
                mentionedJid: options?.mentions
            }
        })
    }

    scope.sendButtonReply = (text = '', buttons = [], options = {
        from: '', footer: 'dev: @zaadevofc', quoted: ''
    }) => {
        return scope.sendMessage(options?.from, {
            text,
            footer: options.footer,
            buttons,
            headerType: 4,
            contextInfo: {
                mentionedJid: options?.mentions
            }
        }, {
            quoted: options?.quoted
        })
    }

    scope.sendButtonImg = (caption = '', button = [], image = '', options = {
        from: '', footer: 'dev: @zaadevofc'
    }) => {
        return scope.sendMessage(options?.from, {
            caption,
            image,
            viewOnce: true,
            templateButtons: button,
            footer: options.footer,
            contextInfo: {
                mentionedJid: options?.mentions
            }
        })
    }

    scope.sendButtonThumb = async (caption = '', button = [], image = '', options = {
        from: '', footer: 'dev: @zaadevofc'
    }) => {
        return scope.sendMessage(options?.from, {
            caption,
            location: {
                jpegThumbnail: image
            },
            viewOnce: true,
            templateButtons: button,
            footer: options.footer,
            contextInfo: {
                mentionedJid: options?.mentions
            }
        })
    }

    scope.sendButtonVid = (caption = '', button = [], video = '', options = {
        from: '', footer: 'dev: @zaadevofc'
    }) => {
        return scope.sendMessage(options?.from, {
            caption,
            video,
            viewOnce: true,
            templateButtons: button,
            footer: options.footer,
            contextInfo: {
                mentionedJid: options?.mentions
            }
        })
    }

    scope.sendButtonGif = (caption = '', button = [], gif = '', options = {
        from: '', footer: 'dev: @zaadevofc'
    }) => {
        return scope.sendMessage(options?.from, {
            caption,
            video: gif,
            gifPlayback: true,
            viewOnce: true,
            templateButtons: button,
            footer: options.footer,
            contextInfo: {
                mentionedJid: options?.mentions
            }
        })
    }

    scope.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }
    scope.getName = (jid, withoutContact = false) => {
        id = scope.decodeJid(jid)
        withoutContact = scope.withoutContact || withoutContact
        let v
        if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
            v = store.contacts[id] || {}
            if (!(v.name || v.subject)) v = scope.groupMetadata(id) || {}
            resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
        else v = id === '0@s.whatsapp.net' ? {
            id,
            name: 'WhatsApp'
        }: id === scope.decodeJid(scope.user.id) ?
        scope.user:
        (store.contacts[id] || {})
        return (withoutContact ? '': v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
    }
    scope.sendContact = async (jid, kon, quoted = '', opts = {}) => {
        let list = []
        for (let i of kon) {
            list.push({
                displayName: await scope.getName(i + '@s.whatsapp.net'),
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${await scope.getName(i + '@s.whatsapp.net')}\nFN:${await scope.getName(i + '@s.whatsapp.net')}\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:Ponsel\nitem2.EMAIL;type=INTERNET:zddev@gmail.com\nitem2.X-ABLabel:Email\nitem3.URL:https://instagram.com/scope.dev\nitem3.X-ABLabel:Instagram\nitem4.ADR:;;Indonesia;;;;\nitem4.X-ABLabel:Region\nEND:VCARD`
            })
        }
        scope.sendMessage(jid, {
            contacts: {
                displayName: `${list.length} Kontak`, contacts: list
            }, ...opts
        }, {
            quoted
        })
    }
    scope.setStatus = (status) => {
        scope.query({
            tag: 'iq',
            attrs: {
                to: '@s.whatsapp.net',
                type: 'set',
                xmlns: 'status',
            },
            content: [{
                tag: 'status',
                attrs: {},
                content: Buffer.from(status, 'utf-8')
            }]
        })
        return status
    }
    /** Resize Image
    *
    * @param {Buffer} Buffer (Only Image)
    * @param {Numeric} Width
    * @param {Numeric} Height
    */
    scope.reSize = async (image, width, height) => {
        let jimp = require('jimp')
        var oyy = await jimp.read(image);
        var kiyomasa = await oyy.resize(width, height).getBufferAsync(jimp.MIME_JPEG)
        return kiyomasa
    }
    /**
    *
    * @param {*} jid
    * @param {*} url
    * @param {*} caption
    * @param {*} quoted
    * @param {*} options
    */
    scope.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
        let mime = '';
        let res = await axios.head(url)
        mime = res.headers['content-type']
        if (mime.split("/")[1] === "gif") {
            return scope.sendMessage(jid, {
                video: await getBuffer(url), caption: caption, gifPlayback: true, ...options
            }, {
                quoted: quoted, ...options
            })
        }
        let type = mime.split("/")[0]+"Message"
        if (mime === "application/pdf") {
            return scope.sendMessage(jid, {
                document: await getBuffer(url), mimetype: 'application/pdf', caption: caption, ...options
            }, {
                quoted: quoted, ...options
            })
        }
        if (mime.split("/")[0] === "image") {
            return scope.sendMessage(jid, {
                image: await getBuffer(url), caption: caption, ...options
            }, {
                quoted: quoted, ...options
            })
        }
        if (mime.split("/")[0] === "video") {
            return scope.sendMessage(jid, {
                video: await getBuffer(url), caption: caption, mimetype: 'video/mp4', ...options
            }, {
                quoted: quoted, ...options
            })
        }
        if (mime.split("/")[0] === "audio") {
            return scope.sendMessage(jid, {
                audio: await getBuffer(url), caption: caption, mimetype: 'audio/mpeg', ...options
            }, {
                quoted: quoted, ...options
            })
        }
    }
    /** Send List Messaage
    *@param {*} jid
    *@param {*} text
    *@param {*} footer
    *@param {*} title
    *@param {*} butText
    *@param [*] sections
    *@param {*} quoted
    */
    scope.sendListMsg = (jid, text = '', footer = '', title = '', butText = '', sects = [], quoted) => {
        let sections = sects
        var listMes = {
            text: text,
            footer: footer,
            title: title,
            buttonText: butText,
            sections
        }
        scope.sendMessage(jid, listMes, {
            quoted: quoted
        })
    }
    /** Send Button 5 Location
    * @param {*} jid
    * @param {*} text
    * @param {*} footer
    * @param {*} location
    * @param [*] button
    * @param {*} options
    */
    scope.send5ButLoc = async (jid, text = '', footer = '', lok, but = [], options = {}) => {
        let bb = await scope.reSize(lok, 300, 300)
        scope.sendMessage(jid, {
            location: {
                jpegThumbnail: bb
            }, caption: text, footer: footer, templateButtons: but, ...options
        })
    }

    /** Send Button 5 Message
    * @param {*} jid
    * @param {*} text
    * @param {*} footer
    * @param {*} button
    * @returns
    */
    scope.send5ButMsg = (jid, text = '', footer = '', but = []) => {
        let templateButtons = but
        var templateMessage = {
            text: text,
            footer: footer,
            templateButtons: templateButtons
        }
        scope.sendMessage(jid, templateMessage)
    }

    /** Send Button 5 Image
    * @param {*} jid
    * @param {*} text
    * @param {*} footer
    * @param {*} image
    * @param [*] button
    * @param {*} options
    * @returns
    */
    scope.send5ButImg = async (jid, text = '', footer = '', img, but = [], options = {}) => {
        let message = await prepareWAMessageMedia({
            image: img
        }, {
            upload: scope.waUploadToServer
        })
        var template = generateWAMessageFromContent(jid, proto.Message.fromObject({
            templateMessage: {
                hydratedTemplate: {
                    imageMessage: message.imageMessage,
                    "hydratedContentText": text,
                    "hydratedFooterText": footer,
                    "hydratedButtons": but
                }
            }
        }), options)
        scope.relayMessage(jid, template.message, {
            messageId: template.key.id
        })
    }
    /** Send Button 5 Video
    * @param {*} jid
    * @param {*} text
    * @param {*} footer
    * @param {*} Video
    * @param [*] button
    * @param {*} options
    * @returns
    */
    scope.send5ButVid = async (jid, text = '', footer = '', vid, but = [], options = {}) => {
        let message = await prepareWAMessageMedia({
            video: vid
        }, {
            upload: scope.waUploadToServer
        })
        var template = generateWAMessageFromContent(jid, proto.Message.fromObject({
            templateMessage: {
                hydratedTemplate: {
                    videoMessage: message.videoMessage,
                    "hydratedContentText": text,
                    "hydratedFooterText": footer,
                    "hydratedButtons": but
                }
            }
        }), options)
        scope.relayMessage(jid, template.message, {
            messageId: template.key.id
        })
    }
    /** Send Button 5 Gif
    * @param {*} jid
    * @param {*} text
    * @param {*} footer
    * @param {*} Gif
    * @param [*] button
    * @param {*} options
    * @returns
    */
    scope.send5ButGif = async (jid, text = '', footer = '', gif, but = [], options = {}) => {
        let message = await prepareWAMessageMedia({
            video: gif, gifPlayback: true
        }, {
            upload: scope.waUploadToServer
        })
        var template = generateWAMessageFromContent(jid, proto.Message.fromObject({
            templateMessage: {
                hydratedTemplate: {
                    videoMessage: message.videoMessage,
                    "hydratedContentText": text,
                    "hydratedFooterText": footer,
                    "hydratedButtons": but
                }
            }
        }), options)
        scope.relayMessage(jid, template.message, {
            messageId: template.key.id
        })
    }
    /**
    * @param {*} jid
    * @param {*} buttons
    * @param {*} caption
    * @param {*} footer
    * @param {*} quoted
    * @param {*} options
    */
    scope.sendButtonText = (jid, buttons = [], text, footer, quoted = '', options = {}) => {
        let buttonMessage = {
            text,
            footer,
            buttons,
            headerType: 2,
            ...options
        }
        scope.sendMessage(jid, buttonMessage, {
            quoted, ...options
        })
    }
    /**
    * @param {*} jid
    * @param {*} text
    * @param {*} quoted
    * @param {*} options
    * @returns
    */
    scope.sendText = (jid, text, quoted = '', options) => scope.sendMessage(jid, {
        text: text, ...options
    }, {
        quoted
    })
    /**
    * @param {*} jid
    * @param {*} path
    * @param {*} caption
    * @param {*} quoted
    * @param {*} options
    * @returns
    */
    scope.sendImage = async (jid, path, caption = '', quoted = '', options) => {
        let buffer = Buffer.isBuffer(path) ? path: /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64'): /^https?:\/\//.test(path) ? await (await getBuffer(path)): fs.existsSync(path) ? fs.readFileSync(path): Buffer.alloc(0)
        return await scope.sendMessage(jid, {
            image: buffer, caption: caption, ...options
        }, {
            quoted
        })
    }
    /**
    * @param {*} jid
    * @param {*} path
    * @param {*} caption
    * @param {*} quoted
    * @param {*} options
    * @returns
    */
    scope.sendVideo = async (jid, path, caption = '', quoted = '', gif = false, options) => {
        let buffer = Buffer.isBuffer(path) ? path: /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64'): /^https?:\/\//.test(path) ? await (await getBuffer(path)): fs.existsSync(path) ? fs.readFileSync(path): Buffer.alloc(0)
        return await scope.sendMessage(jid, {
            video: buffer, caption: caption, gifPlayback: gif, ...options
        }, {
            quoted
        })
    }
    /**
    * @param {*} jid
    * @param {*} path
    * @param {*} quoted
    * @param {*} mime
    * @param {*} options
    * @returns
    */
    scope.sendAudio = async (jid, path, quoted = '', ptt = false, options) => {
        let buffer = Buffer.isBuffer(path) ? path: /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64'): /^https?:\/\//.test(path) ? await (await getBuffer(path)): fs.existsSync(path) ? fs.readFileSync(path): Buffer.alloc(0)
        return await scope.sendMessage(jid, {
            audio: buffer, ptt: ptt, ...options
        }, {
            quoted
        })
    }
    /**
    * @param {*} jid
    * @param {*} text
    * @param {*} quoted
    * @param {*} options
    * @returns
    */
    scope.sendTextWithMentions = async (jid, text, quoted, options = {}) => scope.sendMessage(jid, {
        text: text, contextInfo: {
            mentionedJid: [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net')
        }, ...options
    }, {
        quoted
    })
    /**
    * @param {*} jid
    * @param {*} path
    * @param {*} quoted
    * @param {*} options
    * @returns
    */
    scope.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? path: /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64'): /^https?:\/\//.test(path) ? await (await getBuffer(path)): fs.existsSync(path) ? fs.readFileSync(path): Buffer.alloc(0)
        let buffer
        if (options && (options.packname || options.author)) {
            buffer = await writeExifImg(buff, options)
        } else {
            buffer = await imageToWebp(buff)
        }

        await scope.sendMessage(jid, {
            sticker: {
                url: buffer
            }, ...options
        }, {
            quoted
        })
        return buffer
    }
    /**
    * @param {*} jid
    * @param {*} path
    * @param {*} quoted
    * @param {*} options
    * @returns
    */
    scope.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? path: /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64'): /^https?:\/\//.test(path) ? await (await getBuffer(path)): fs.existsSync(path) ? fs.readFileSync(path): Buffer.alloc(0)
        let buffer
        if (options && (options.packname || options.author)) {
            buffer = await writeExifVid(buff, options)
        } else {
            buffer = await videoToWebp(buff)
        }

        await scope.sendMessage(jid, {
            sticker: {
                url: buffer
            }, ...options
        }, {
            quoted
        })
        return buffer
    }
    /**
    * @param {*} message
    * @param {*} filename
    * @param {*} attachExtension
    * @returns
    */
    scope.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
        let quoted = message.msg ? message.msg: message
        let mime = (message.msg || message).mimetype || ''
        let messageType = message.mtype ? message.mtype.replace(/Message/gi, ''): mime.split('/')[0]
        const stream = await downloadContentFromMessage(quoted, messageType)
        let buffer = Buffer.from([])
        for await(const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk])
        }
        let type = await FileType.fromBuffer(buffer)
        trueFileName = attachExtension ? (filename + '.' + type.ext): filename
        // save to file
        await fs.writeFileSync(trueFileName, buffer)
        return trueFileName
    }

    scope.downloadMediaMessage = async (message) => {
        let mime = (message.msg || message).mimetype || ''
        let messageType = message.mtype ? message.mtype.replace(/Message/gi, ''): mime.split('/')[0]
        const stream = await downloadContentFromMessage(message, messageType)
        let buffer = Buffer.from([])
        for await(const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk])
        }

        return buffer
    }
    /**
    * @param {*} jid
    * @param {*} path
    * @param {*} filename
    * @param {*} caption
    * @param {*} quoted
    * @param {*} options
    * @returns
    */
    scope.sendMedia = async (jid, path, fileName = '', caption = '', quoted = '', options = {}) => {
        let types = await scope.getFile(path, true)
        let {
            mime,
            ext,
            res,
            data,
            filename
        } = types
        if (res && res.status !== 200 || file.length <= 65536) {
            try {
                throw {
                    json: JSON.parse(file.toString())
                }
            }
            catch (e) {
                if (e.json) throw e.json
            }
        }
        let type = '',
        mimetype = mime,
        pathFile = filename
        if (options.asDocument) type = 'document'
        if (options.asSticker || /webp/.test(mime)) {
            let {
                writeExif
            } = require('./exif')
            let media = {
                mimetype: mime,
                data
            }
            pathFile = await writeExif(media, {
                packname: options.packname ? options.packname: global.packname, author: options.author ? options.author: global.author, categories: options.categories ? options.categories: []
            })
            await fs.promises.unlink(filename)
            type = 'sticker'
            mimetype = 'image/webp'
        } else if (/image/.test(mime)) type = 'image'
        else if (/video/.test(mime)) type = 'video'
        else if (/audio/.test(mime)) type = 'audio'
        else type = 'document'
        await scope.sendMessage(jid, {
            [type]: {
                url: pathFile
            }, caption, mimetype, fileName, ...options
        }, {
            quoted, ...options
        })
        return fs.promises.unlink(pathFile)
    }
    /**
    * @param {*} jid
    * @param {*} message
    * @param {*} forceForward
    * @param {*} options
    * @returns
    */
    scope.copyNForward = async (jid, message, forceForward = false, options = {}) => {
        let vtype
        if (options.readViewOnce) {
            message.message = message.message && message.message.ephemeralMessage && message.message.ephemeralMessage.message ? message.message.ephemeralMessage.message: (message.message || undefined)
            vtype = Object.keys(message.message.viewOnceMessage.message)[0]
            delete(message.message && message.message.ignore ? message.message.ignore: (message.message || undefined))
            delete message.message.viewOnceMessage.message[vtype].viewOnce
            message.message = {
                ...message.message.viewOnceMessage.message
            }
        }

        let mtype = Object.keys(message.message)[0]
        let content = await generateForwardMessageContent(message, forceForward)
        let ctype = Object.keys(content)[0]
        let context = {}
        if (mtype != "conversation") context = message.message[mtype].contextInfo
        content[ctype].contextInfo = {
            ...context,
            ...content[ctype].contextInfo
        }
        const waMessage = await generateWAMessageFromContent(jid, content, options ? {
            ...content[ctype],
            ...options,
            ...(options.contextInfo ? {
                contextInfo: {
                    ...content[ctype].contextInfo,
                    ...options.contextInfo
                }
            }: {})
        }: {})
        await scope.relayMessage(jid, waMessage.message, {
            messageId: waMessage.key.id
        })
        return waMessage
    }

    scope.cMod = (jid, copy, text = '', sender = scope.user.id, options = {}) => {
        //let copy = message.toJSON()
        let mtype = Object.keys(copy.message)[0]
        let isEphemeral = mtype === 'ephemeralMessage'
        if (isEphemeral) {
            mtype = Object.keys(copy.message.ephemeralMessage.message)[0]
        }
        let msg = isEphemeral ? copy.message.ephemeralMessage.message: copy.message
        let content = msg[mtype]
        if (typeof content === 'string') msg[mtype] = text || content
        else if (content.caption) content.caption = text || content.caption
        else if (content.text) content.text = text || content.text
        if (typeof content !== 'string') msg[mtype] = {
            ...content,
            ...options
        }
        if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant
        else if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant
        if (copy.key.remoteJid.includes('@s.whatsapp.net')) sender = sender || copy.key.remoteJid
        else if (copy.key.remoteJid.includes('@broadcast')) sender = sender || copy.key.remoteJid
        copy.key.remoteJid = jid
        copy.key.fromMe = sender === scope.user.id

        return proto.WebMessageInfo.fromObject(copy)
    }
    /**
    * @param {*} path
    * @returns
    */
    scope.getFile = async (PATH, save) => {
        let res
        let data = Buffer.isBuffer(PATH) ? PATH: /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split`,`[1], 'base64'): /^https?:\/\//.test(PATH) ? await (res = await getBuffer(PATH)): fs.existsSync(PATH) ? (filename = PATH, fs.readFileSync(PATH)): typeof PATH === 'string' ? PATH: Buffer.alloc(0)
        //if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer')
        let type = await FileType.fromBuffer(data) || {
            mime: 'application/octet-stream',
            ext: '.bin'
        }
        filename = path.join(__filename, '../tmp/' + new Date * 1 + '.' + type.ext)
        if (data && save) fs.promises.writeFile(filename, data)
        return {
            res,
            filename,
            size: await getSizeMedia(data),
            ...type,
            data
        }
    }
}