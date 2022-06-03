;(function ($) {

    const PLUGIN_NAME = 'words'
    const CLS = {
        exact   : 'exact',
        guess   : 'guess',
        tile    : 'tile',
        match   : 'match',
        nomatch : 'nomatch',
        partial : 'partial',
        root    : 'words-root',
    }

    function Plugin(opts) {
        if (opts === 'instance') {
            return Api.getInstance(this)
        }
        return this.each(function() {
            var $root = $(this)
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
        wordLength : 5,
        maxGuesses : 6,
    }

    $.fn[PLUGIN_NAME] = Plugin

    function Api($root) {
        if ($root.length !== 1) {
            throw new Error('Cannot create Api for length ' + $root.length)
        }
        const id = $root.attr('id')
        if (Api.instances[id]) {
            throw new Error('Instance already created for id ' + id)
        }
        if (id == null || !id.length) {
            throw new Error('Cannot create Api for id "' + String(id) + '"')
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
        this.word = Words.selectWord(opts.wordLength)
        this.input = ''
        this.guess = 0
        this.finished = false
        console.log(this.word)
        const $board = $('<div/>')
        for (var i = 0; i < opts.maxGuesses; i++) {
            var $guess = $('<div/>').addClass(CLS.guess)
            for (var j = 0; j < opts.wordLength; j++) {
                var $tile = $('<div/>').addClass(CLS.tile)
                $tile.html('&nbsp;')
                $guess.append($tile)
            }
            $board.append($guess)
        }
        this.$root.empty().addClass(CLS.root).append($board)
        return this
    }

    Api.fn.destroy = function() {
        if (this.$root) {
            this.$root.removeClass(CLS.root)
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
            throw new Error('Invalid letter: ' + letter)
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
        // TODO ...
        if (this.finished || this.input.length !== this.opts.wordLength) {
            return
        }
        if (!Words.isWord(this.input)) {
            // console.log('not a word')
            return
        }
        const result = Words.guessResult(this.input, this.word)
        $('.' + CLS.guess + ':eq(' + this.guess + ')', this.$root)
            .find('.' + CLS.tile).each(function(i) {
                const $tile = $(this)
                const rescode = result[i]
                if (rescode > 0) {
                    $tile.addClass(CLS.match)
                    if (rescode === 1) {
                        $tile.addClass(CLS.partial)
                    } else if (rescode === 2) {
                        $tile.addClass(CLS.exact)
                    }
                } else {
                    $tile.addClass(CLS.nomatch)
                }
            })
        if (this.guess === this.opts.maxGuesses - 1 || this.input === this.word) {
            this.finished = true
        } else {
            this.guess += 1
        }
        this.input = ''
        return this
    }

    $(document).ready(function() {
        $(document).on('keydown', function(e) {
            if (e.metaKey || e.ctrlKey || e.altKey) {
                return
            }
            const api = Api.activeInstance
            if (!api || api.finished) {
                return
            }
            const key = e.key.toLowerCase()
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
            }
        })
    })

})(jQuery);