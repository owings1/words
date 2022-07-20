import * as Words from './shared.js'
import $ from './jquery.js'

function Plugin(opts) {
    if (opts === 'instance') {
        return Api.getInstance(this)
    }
    return this.each(function() {
        const $root = $(this)
        let api = Api.getInstance($root)
        if (api) {
            if (typeof(api[opts]) === 'function') {
                const args = Array.prototype.slice.call(arguments, 1)
                api[opts].apply(api, args)
            }
        } else {
            api = new Api($root)
            api.init(opts)
            if (!Api.active) {
                Api.active = api
            }
        }
    })
}

const PLUGIN_NAME = 'words'

const CLS = {
    board    : 'board',
    controls : 'controls',
    exact    : 'match-exact',
    guess    : 'guess',
    tile     : 'tile',
    match    : 'match',
    nomatch  : 'nomatch',
    partial  : 'match-partial',
    root     : 'words-root',
    mode     : 'mode',
    candCount : 'candidate-count',
}

const MODE = {
    answer : 'answer',
    clue   : 'clue',
}

$.fn[PLUGIN_NAME] = Plugin

Plugin.defaults = {
    mode       : MODE.answer,
    wordLength : 5,
    maxGuesses : 6,
}

$(() => {
    $(document)
        .on('keydown', onKeydown)
        .on('click', onClick)
        .on('change', onChange)
})

class Api {

    /**
     * @param {string|object} ref The reference selector or element.
     * @return {Api} The associated instance.
     */
    static getInstance(ref) {
        if (Api.instances[ref]) {
            return Api.instances[ref]
        }
        if (typeof ref.attr !== 'function') {
            ref = $(ref)
        }
        if (ref.length > 1) {
            $.error(`Cannot get instance for object with length ${ref.length}`)
        }
        return Api.instances[ref.attr('id')]
    }

    /**
     * @param {object} $root The root jQuery element.
     */
    constructor($root) {
        if ($root.length !== 1) {
            $.error(`Cannot create Api for length ${$root.length}`)
        }
        const id = $root.attr('id')
        if (Api.instances[id]) {
            $.error(`Instance already created for id ${id}`)
        }
        if (id == null || !id.length) {
            $.error(`Cannot create Api for id '${String(id)}'`)
        }
        Object.defineProperties(this, {
            id    : {value: id},
            $root : {value: $root},
        })
        Api.instances[id] = this
    }

    /** @type {string} */
    get mode() {
        return MODE[this.opts.mode] || Plugin.defaults.mode
    }

    set mode(value) {
        this.opts.mode = value
    }

    /**
     * @param {object} opts
     * @return {Api} self
     */
    init(opts = undefined) {
        this.destroy()
        this.$root.addClass(CLS.root)
        Api.instances[this.id] = this
        opts = this.opts = $.extend(true, Plugin.defaults, this.opts, opts)
        if (this.mode === MODE.answer) {
            this.answer = Words.selectWord(opts.wordLength)
        }
        this.input = ''
        this.guessi = 0
        this.finished = false
        this.history = []
        this.candidates = Words.getDictionary(opts.wordLength)
        setupBoard.call(this)
        setupControls.call(this)
        writeCandidateCount.call(this)
        if (Api.active === null) {
            Api.active = this
        }
        return this
    }

    /**
     * @return {Api} self
     */
    reset() {
        const answer = this.answer
        this.init()
        switch (this.mode) {
            case MODE.answer:
                this.answer = answer
                break
            case MODE.clue:
                this.answer = undefined
                break
        }
        return this
    }

    /**
     * @return {Api} self
     */
    destroy() {
        this.$root.empty()
        delete Api.instances[this.id]
        if (Api.active === this) {
            Api.active = null
        }
        return this
    }

    /**
     * @param {string} letter
     * @return {Api} self
     */
    pushLetter(letter) {
        if (this.finished) {
            return
        }
        letter = letter.toLowerCase()
        if (!/^[a-z]$/.test(letter)) {
            $.error(`Invalid letter: ${letter}`)
        }
        if (this.input.length >= this.opts.wordLength) {
            return
        }
        $(`.${CLS.guess}:eq(${this.guessi})`, this.$root)
            .find(`.${CLS.tile}:eq(${this.input.length})`)
            .text(letter)
        this.input += letter
        return this
    }

    /**
     * @return {Api} self
     */
    popLetter() {
        if (this.finished || !this.input.length) {
            return
        }
        this.input = this.input.substring(0, this.input.length - 1)
        $(`.${CLS.guess}:eq(${this.guessi})`, this.$root)
            .find(`.${CLS.tile}:eq(${this.input.length})`)
            .html('&nbsp;')
        return this
    }

    /**
     * @return {Api} self
     */
    submit() {
        if (this.finished || this.input.length !== this.opts.wordLength) {
            return
        }
        if (!Words.isWord(this.input)) {
            // Not a word!
            return
        }
        /** @type {Words.Clue} */
        let clue
        switch (this.mode) {
            case MODE.answer:
                clue = Words.getClue(this.input, this.answer)
                break
            case MODE.clue:
                clue = readClue.call(this)
                if (clue.isFullMatch()) {
                    this.answer = this.input
                }
                break
        }
        const groups = Words.getGroups(this.input, this.candidates)
        this.candidates = Words.reduceCandidates(this.input, clue, this.candidates)
        this.history.push({input: this.input, clue})
        console.log(this.candidates)
        console.log(groups)

        highlightClue.call(this, clue)
        if (this.guessi === this.opts.maxGuesses - 1 || this.input === this.answer) {
            this.finished = true
        } else {
            this.guessi += 1
            writeCandidateCount.call(this)
        }
        this.input = ''
        return this
    }

    /**
     * @param {boolean} value The toggle boolean value.
     * @return {Api} self
     */
    toggleCandidatesCount(value = undefined) {
        $(`.${CLS.candCount}`, this.$root).toggle(value)
        return this
    }
}

Api.instances = Object.create(null)
Api.active = null

/**
 * @private Api private method.
 * @param {Words.Clue} clue
 */
function highlightClue(clue) {
    $(`.${CLS.guess}:eq(${this.guessi})`, this.$root)
        .find(`.${CLS.tile}`).each(function(i) {
            const $tile = $(this)
            const clueCode = clue[i]
            switch (clueCode) {
                case Words.NOMATCH:
                    $tile.addClass(CLS.nomatch)
                    break
                case Words.PARTIAL:
                    $tile.addClass(CLS.partial)
                    break
                case Words.EXACT:
                    $tile.addClass(CLS.exact)
                    break
                default:
                    $.error(`Invalid clue code: ${clueCode}`)
            }
        })
}

/**
 * @private Api private method.
 * @return {Words.Clue}
 */
function readClue() {
    const clue = new Words.Clue
    $(`.${CLS.guess}:eq(${this.guessi})`, this.$root)
        .find(`.${CLS.tile}`).each(function(i) {
            const $tile = $(this)
            if ($tile.hasClass(CLS.exact)) {
                clue.push(Words.EXACT)
            } else if ($tile.hasClass(CLS.partial)) {
                clue.push(Words.PARTIAL)
            } else {
                clue.push(Words.NOMATCH)
            }
        })
    return clue
}

/**
 * @private Api private method.
 */
function setupBoard() {
    const {opts} = this
    const $board = $('<div/>').addClass(CLS.board)
    for (let i = 0; i < opts.maxGuesses; i++) {
        let $guess = $('<div/>').addClass(CLS.guess)
        for (let j = 0; j < opts.wordLength; j++) {
            let $tile = $('<div/>').addClass(CLS.tile).html('&nbsp;')
            $guess.append($tile)
        }
        let $candCount = $('<span/>').addClass(CLS.candCount)
        $guess.append($candCount)
        $board.append($guess)
    }
    this.$root.append($board)
}

/**
 * @private Api private method.
 */
function setupControls() {
    const $fieldset = $('<fieldset/>').append('<legend>Mode</legend>')
    for (let mode in MODE) {
        let id = `${this.id}_mode_${mode}`
        let $label = $('<label/>')
            .attr({for: id})
            .text(mode)
        let $input = $('<input/>')
            .attr({id, type: 'radio', name: 'mode'})
            .addClass(CLS.mode)
            .val(mode)
            .prop('checked', mode === this.mode)
        $fieldset.append($label).append($input)
    }
    this.$root.append($fieldset)
}

/**
 * @private Api private method.
 */
function writeCandidateCount() {
    $(`.${CLS.guess}:eq(${this.guessi})`, this.$root)
        .find(`.${CLS.candCount}`)
        .text(`${this.candidates.length}`)
}

function onClick(e) {
    const api = Api.active
    const $target = $(e.target)
    if (api.mode === MODE.clue && $target.hasClass(CLS.tile)) {
        if (api.finished) {
            return
        }
        let $tile = $target
        let guessi = $tile.closest(`.${CLS.guess}`).index()
        // let tilei = $tile.index()
        if (guessi !== api.guessi) {
            return
        }
        if ($tile.hasClass(CLS.exact)) {
            $tile.removeClass(CLS.exact)
        } else if ($tile.hasClass(CLS.partial)) {
            $tile.removeClass(CLS.partial).addClass(CLS.exact)
        } else {
            $tile.removeClass(CLS.nomatch).addClass(CLS.partial)
        }
        return
    }
}

function onChange(e) {
    const api = Api.active
    const $target = $(e.target)
    if ($target.is(':input') && $target.hasClass(CLS.mode)) {
        api.mode = $target.val()
        api.init()
        return
    }
}

function onKeydown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) {
        return
    }
    const api = Api.active
    if (!api) {
        return
    }
    const key = e.key.toLowerCase()
    if (key === '#') {
        api.toggleCandidateCounts()
        return
    }
    if (key === '!') {
        api.init()
        return
    }
    if (key === '@') {
        api.reset()
        return
    }
    if (api.finished) {
        return
    }
    if (key === 'backspace') {
        api.popLetter()
        return
    }
    if (key === 'enter') {
        api.submit()
        return
    }
    if (/^[a-z]$/.test(key)) {
        api.pushLetter(key)
        return
    }
}
