import $ from './jquery.js'
import Plugin from "./plugin.js"

// TODO: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/dc178ad6fe32416622ec37de703bb72279ab4bb4/types/jquery/README.md#authoring-type-definitions-for-jquery-plugins

// @ts-ignore
$.fn.words = Plugin

// @ts-ignore
$(() => $('.words').words())


// $(() => Plugin.call($('.words')))
