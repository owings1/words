;(function ($) {

    const PLUGIN_NAME = 'words'
    const CLS = {
        exact    : 'exact',
        guess    : 'guess',
        tile     : 'tile',
        match    : 'match',
        nomatch  : 'nomatch',
        partial  : 'partial',
        root     : 'words-root',
        candCount : 'candidate-count',
    }
    const MODE = {
        normal : 'normal',
        clue   : 'clue',
    }

    function Plugin(opts) {
        if (opts === 'instance') {
            return Api.getInstance(this)
        }
        return this.each(function() {
            const $root = $(this)
            var api = Api.getInstance($root)
            if (api) {
                if (typeof(api[opts]) === 'function') {
                    var args = Array.prototype.slice.call(arguments, 1)
                    api[opts].apply(api, args)
                }
            } else {
                api = new Api($root)
                api.init(opts)
                if (!Api.activeInstance) {
                    Api.activeInstance = api
                }
            }
        })
    }

    Plugin.defaults = {
        mode       : MODE.normal,
        wordLength : 5,
        maxGuesses : 6,
    }

    $.fn[PLUGIN_NAME] = Plugin

    function Api($root) {
        if ($root.length !== 1) {
            $.error('Cannot create Api for length ' + $root.length)
        }
        const id = $root.attr('id')
        if (Api.instances[id]) {
            $.error('Instance already created for id ' + id)
        }
        if (id == null || !id.length) {
            $.error('Cannot create Api for id "' + String(id) + '"')
        }
        Object.defineProperties(this, {
            id    : {value: id},
            $root : {value: $root},
        })
        Api.instances[id] = this
    }

    Api.fn = Api.prototype

    Api.instances = Object.create(null)

    Api.activeInstance = null

    Api.getInstance = function(ref) {
        if (Api.instances[ref]) {
            return Api.instances[ref]
        }
        if (typeof ref.attr !== 'function') {
            ref = $(ref)
        }
        if (ref.length > 1) {
            $.error('Cannot get instance for object with length ' + ref.length)
        }
        return Api.instances[ref.attr('id')]
    }

    Api.fn.init = function(opts) {
        this.destroy()
        Api.instances[this.id] = this
        opts = this.opts = $.extend(true, Plugin.defaults, this.opts, opts)
        if (opts.mode !== MODE[opts.mode]) {
            opts.mode = MODE.normal
        }
        this.answer = Words.selectWord(opts.wordLength)
        this.input = ''
        this.guess = 0
        this.finished = false
        this.history = []
        this.candidates = Words.getDictionary(opts.wordLength)
        this._clickHandler = clickHandler.bind(this)
        this.$root.on('click', this._clickHandler)
        // console.log(this.answer)
        setupBoard.call(this)
        writeCandidateCount.call(this)
        if (Api.activeInstance === null) {
            Api.activeInstance = this
        }
        return this
    }

    Api.fn.reset = function() {
        const answer = this.answer
        this.init()
        this.answer = answer
        return this
    }

    Api.fn.destroy = function() {
        if (this.$root) {
            this.$root.removeClass(CLS.root)
                .off('click', this._clickHandler)
                .empty()
        }
        delete Api.instances[this.id]
        if (Api.activeInstance === this) {
            Api.activeInstance = null
        }
        return this
    }

    Api.fn.pushLetter = function(letter) {
        if (this.finished) {
            return
        }
        letter = letter.toLowerCase()
        if (!/^[a-z]$/.test(letter)) {
            $.error('Invalid letter: ' + letter)
        }
        if (this.input.length >= this.opts.wordLength) {
            return
        }
        $('.' + CLS.guess + ':eq(' + this.guess + ')', this.$root)
            .find('.' + CLS.tile + ':eq(' + this.input.length + ')')
            .text(letter)
        this.input += letter
        return this
    }

    Api.fn.popLetter = function() {
        if (this.finished || !this.input.length) {
            return
        }
        this.input = this.input.substring(0, this.input.length - 1)
        $('.' + CLS.guess + ':eq(' + this.guess + ')', this.$root)
            .find('.' + CLS.tile + ':eq(' + this.input.length + ')')
            .html('&nbsp;')
        return this
    }

    Api.fn.submit = function() {
        if (this.finished || this.input.length !== this.opts.wordLength) {
            return
        }
        if (!Words.isWord(this.input)) {
            // Not a word!
            return
        }
        const clue = Words.getClue(this.input, this.answer)
        highlightClue.call(this, clue)
        this.history.push({input: this.input, clue})
        this.candidates = Words.reduceCandidates(this.input, clue, this.candidates)
        console.log(this.candidates)
        if (this.guess === this.opts.maxGuesses - 1 || this.input === this.answer) {
            this.finished = true
        } else {
            this.guess += 1
            writeCandidateCount.call(this)
        }
        this.input = ''
        return this
    }

    Api.fn.toggleCandidateCounts = function(value) {
        $('.' + CLS.candCount, this.$root).toggle(value)
    }

    $(document).ready(function() {
        $(document).on('keydown', onKeydown)
    })

    /**
     * @private
     * @param {integer[]} clue
     */
    function highlightClue(clue) {
        $('.' + CLS.guess + ':eq(' + this.guess + ')', this.$root)
            .find('.' + CLS.tile).each(function(i) {
                const $tile = $(this)
                const clueCode = clue[i]
                if (clueCode > 0) {
                    $tile.addClass(CLS.match)
                    if (clueCode === 1) {
                        $tile.addClass(CLS.partial)
                    } else if (clueCode === 2) {
                        $tile.addClass(CLS.exact)
                    }
                } else {
                    $tile.addClass(CLS.nomatch)
                }
            })
    }

    function readClue() {
        const clue = []
        $('.' + CLS.guess + ':eq(' + this.guess + ')', this.$root)
            .find('.' + CLS.tile).each(function(i) {
                const $tile = $(this)
                if ($tile.hasClass(CLS.exact)) {
                    clue.push(2)
                } else if ($tile.hasClass(CLS.partial)) {
                    clue.push(1)
                } else {
                    clue.push(0)
                }
            })
        return clue
    }
    /**
     * @private
     */
    function setupBoard() {
        const opts = this.opts
        const $board = $('<div/>')
        for (var i = 0; i < opts.maxGuesses; i++) {
            var $guess = $('<div/>').addClass(CLS.guess)
            for (var j = 0; j < opts.wordLength; j++) {
                var $tile = $('<div/>').addClass(CLS.tile)
                $tile.html('&nbsp;')
                $guess.append($tile)
            }
            var $candCount = $('<span/>').addClass(CLS.candCount)
            $guess.append($candCount)
            $board.append($guess)
        }
        this.$root.empty().addClass(CLS.root).append($board)
    }

    /**
     * @private
     */
    function writeCandidateCount() {
        $('.' + CLS.guess + ':eq(' + this.guess + ')', this.$root)
            .find('.' + CLS.candCount)
            .text('' + this.candidates.length)
    }

    function clickHandler(e) {
        const $target = $(e.target)
        if ($target.is('.' + CLS.tile)) {
            console.log($target)
        }
    }

    function onKeydown(e) {
        if (e.metaKey || e.ctrlKey || e.altKey) {
            return
        }
        const api = Api.activeInstance
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

})(jQuery);