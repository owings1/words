import {Clue} from './core.js'
import * as Core from './core.js'
import $ from './jquery.js'

$(() => $(document).on({keydown, click, change}))

export default function Plugin(this: JQuery<HTMLElement>, opt?: string|PluginOpts) {
    if (opt === 'instance') {
        return Api.getInstance(this)
    }
    return this.each(function() {
        const $root = $(this)
        let api = Api.getInstance($root)
        if (api) {
            if (typeof opt === 'string' && typeof(api[opt]) === 'function') {
                const args = Array.prototype.slice.call(arguments, 1)
                api[opt].apply(api, args)
            }
        } else {
            api = new Api($root)
            api.init(opt as PluginOpts)
            if (!Api.active) {
                Api.active = api
            }
        }
    })
}

enum CLS {
    board    = 'board',
    controls = 'controls',
    exact    = 'match-exact',
    guess    = 'guess',
    tile     = 'tile',
    match    = 'match',
    nomatch  = 'nomatch',
    partial  = 'match-partial',
    root     = 'words-root',
    mode     = 'mode',
    candidates = 'candidates',
    candCount = 'candidate-count',
}

enum MODE {
    answer = 'answer',
    clue   = 'clue',
}

type PluginOpts = {
    mode: MODE,
    wordLength: number,
    maxGuesses: number,
}

const symRoot = Symbol()
const symId = Symbol()
const RegexLetter = /^[a-z]$/

class Api {

    static active: Api|null = null
    static instances: {string: Api} = Object.create(null)
    static defaults: PluginOpts = {
        mode       : MODE.answer,
        wordLength : 5,
        maxGuesses : 6,
    };

    [symId]: string
    [symRoot]: JQuery<HTMLElement>

    input: string
    guessi: number
    answer?: string
    finished: boolean
    opts: PluginOpts
    candidates: string[]
    history: {
        input: string,
        clue: Clue,
    }[]

    /**
     * @param ref The reference selector or element.
     * @return The associated instance.
     */
    static getInstance(ref: string|HTMLElement|JQuery<HTMLElement>): Api {
        if (typeof ref === 'string' && Api.instances[ref]) {
            return Api.instances[ref]
        }
        const $ref = $(ref as string)
        if ($ref.length > 1) {
            $.error(`Cannot get instance for object with length ${$ref.length}`)
        }
        return Api.instances[$ref.attr('id')]
    }

    /**
     * @param $root The root jQuery element.
     */
    constructor($root: JQuery<HTMLElement>) {
        if ($root.length !== 1) {
            $.error(`Cannot create Api for length ${$root.length}`)
        }
        const id = $root.attr('id')
        if (Api.instances[id]) {
            $.error(`Instance already created for id ${id}`)
        }
        if (id == null || !id.length) {
            $.error(`Cannot create Api for id '${id}'`)
        }
        this[symRoot] = $root
        this[symId] = id
        Api.instances[id] = this
    }

    get id() {
        return this[symId]
    }

    get $root() {
        return this[symRoot]
    }

    get $candidates() {
        return $(`.${CLS.candidates}`, this.$root)
    }

    get $guess() {
        return getGuess.call(this)
    }

    get mode() {
        return MODE[this.opts.mode] || Api.defaults.mode
    }

    set mode(value: MODE) {
        this.opts.mode = value
    }

    init(opts?: PluginOpts): this {
        this.destroy()
        this.$root.addClass(CLS.root)
        Api.instances[this.id] = this
        this.opts = $.extend(true, Api.defaults, this.opts, opts)
        if (this.mode === MODE.answer) {
            this.answer = Core.selectWord(this.opts.wordLength)
        }
        this.input = ''
        this.guessi = 0
        this.finished = false
        this.history = []
        this.candidates = Core.getDictionary(this.opts.wordLength)
        setupBoard.call(this)
        setupControls.call(this)
        setupDetails.call(this)
        writeCandidateCount.call(this)
        if (Api.active === null) {
            Api.active = this
        }
        return this
    }

    reset(): this {
        const {answer} = this
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

    destroy(): this {
        this.$root.empty()
        delete Api.instances[this.id]
        if (Api.active === this) {
            Api.active = null
        }
        return this
    }

    pushLetter(letter: string): this {
        if (this.finished) {
            return this
        }
        letter = letter.toLowerCase()
        if (!RegexLetter.test(letter)) {
            $.error(`Invalid letter: ${letter}`)
        }
        if (this.input.length >= this.opts.wordLength) {
            return this
        }
        this.$guess
            .find(`.${CLS.tile}:eq(${this.input.length})`)
            .text(letter)
        this.input += letter
        return this
    }

    popLetter(): this {
        if (this.finished || !this.input.length) {
            return this
        }
        this.input = this.input.substring(0, this.input.length - 1)
        this.$guess
            .find(`.${CLS.tile}:eq(${this.input.length})`)
            .html('&nbsp;')
        return this
    }

    submit(): this {
        if (this.finished || this.input.length !== this.opts.wordLength) {
            return this
        }

        let clue: Clue
        switch (this.mode) {
            case MODE.answer:
                if (!Core.isWord(this.input)) {
                    // Not a word!
                    return this
                }
                clue = Core.getClue(this.input, this.answer)
                break
            case MODE.clue:
                clue = readClue.call(this)
                if (clue.isFullMatch()) {
                    this.answer = this.input
                }
                break
        }
        const groups = Core.getGroups(this.input, this.candidates)
        this.candidates = Core.reduceCandidates(this.input, clue, this.candidates)
        this.history.push({input: this.input, clue})

        console.log(this.candidates)
        console.log(groups)

        highlightClue.call(this, clue)
        if (this.guessi === this.opts.maxGuesses - 1 || this.input === this.answer) {
            this.finished = true
        } else {
            this.guessi += 1
            writeCandidateCount.call(this)
            writeCandidates.call(this)
        }
        this.input = ''
        return this
    }

    toggleCandidatesCount(value?: boolean): this {
        $(`.${CLS.candCount}`, this.$root).toggle(value)
        return this
    }

    toggleCandidates(value?: boolean): this {
        this.$candidates.toggle(value)
        return this
    }
}

function highlightClue(this: Api, clue: Clue) {
    this.$guess
        .find(`.${CLS.tile}`).each(function(i: number) {
            const $tile = $(this)
            const clueCode = clue[i]
            switch (clueCode) {
                case Core.NOMATCH:
                    $tile.addClass(CLS.nomatch)
                    break
                case Core.PARTIAL:
                    $tile.addClass(CLS.partial)
                    break
                case Core.EXACT:
                    $tile.addClass(CLS.exact)
                    break
                default:
                    $.error(`Invalid clue code: ${clueCode}`)
            }
        })
}

function readClue(this: Api): Clue {
    const clue = new Clue
    this.$guess
        .find(`.${CLS.tile}`).each(function() {
            const $tile = $(this)
            if ($tile.hasClass(CLS.exact)) {
                clue.push(Core.EXACT)
            } else if ($tile.hasClass(CLS.partial)) {
                clue.push(Core.PARTIAL)
            } else {
                clue.push(Core.NOMATCH)
            }
        })
    return clue
}

function setupBoard(this: Api) {
    const {opts} = this
    const $board = $('<div/>').addClass(CLS.board)
    for (let i = 0; i < opts.maxGuesses; i++) {
        const $guess = $('<div/>').addClass(CLS.guess)
        for (let j = 0; j < opts.wordLength; j++) {
            $('<div/>')
                .addClass(CLS.tile)
                .html('&nbsp;')
                .appendTo($guess)
        }
        $('<span/>')
            .addClass(CLS.candCount)
            .appendTo($guess)
        $board.append($guess)
    }
    this.$root.append($board)
}

function setupControls(this: Api) {
    const $fieldset = $('<fieldset/>')
    $('<legend/>').text('Mode').appendTo($fieldset)
    for (const mode in MODE) {
        const id = `${this.id}_mode_${mode}`
        const $label = $('<label/>')
            .attr({for: id})
            .text(mode)
        const $input = $('<input/>')
            .attr({id, type: 'radio', name: 'mode'})
            .addClass(CLS.mode)
            .val(mode)
            .prop('checked', mode === this.mode)
        $fieldset.append($label).append($input)
    }
    this.$root.append($fieldset)
}

function setupDetails(this: Api) {
    $('<ul/>').addClass(CLS.candidates).appendTo(this.$root)
}

function getGuess(this: Api, i?: number): JQuery<HTMLElement> {
    if (i === undefined) {
        i = this.guessi
    }
    return $(`.${CLS.guess}:eq(${i})`, this.$root)
}

function writeCandidates(this: Api) {
    const $cands = this.$candidates
    $cands.empty()
    if (this.guessi < 1) {
        return
    }
    this.candidates.forEach(word => {
        $('<li/>').text(word).appendTo($cands)
    })

}
function writeCandidateCount(this: Api) {
    this.$guess
        .find(`.${CLS.candCount}`)
        .text(`${this.candidates.length}`)
}

function click(e: MouseEvent) {
    const api = Api.active
    if (!api) {
        return
    }
    const $target = $(e.target)
    if (api.mode === MODE.clue && $target.hasClass(CLS.tile)) {
        if (api.finished) {
            return
        }
        const $tile = $target
        const guessi = $tile.closest(`.${CLS.guess}`).index()
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

function change(e: Event) {
    const api = Api.active
    if (!api) {
        return
    }
    const $target = $(e.target)
    if ($target.is(':input') && $target.hasClass(CLS.mode)) {
        api.mode = MODE[String($target.val())]
        api.init()
        return
    }
}

function keydown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) {
        return
    }
    const api = Api.active
    if (!api) {
        return
    }
    const key = e.key.toLowerCase()
    switch (key) {
        case '%':
            api.toggleCandidates()
            return
        case '#':
            api.toggleCandidatesCount()
            return
        case '!':
            api.init()
            return
        case '@':
            api.reset()
            return

    }
    if (api.finished) {
        return
    }
    switch (key) {
        case 'backspace':
            api.popLetter()
            return
        case 'enter':
            api.submit()
            return
    }
    if (RegexLetter.test(key)) {
        api.pushLetter(key)
        return
    }
}
