import * as monaco from 'monaco-editor'
import * as parametricSVG from 'parametric-svg'
import xmlbuilder from 'xmlbuilder'
import yaml from 'js-yaml'
import camelCase from 'camelcase'
import {sha1} from 'crypto-hash'
import basex from 'base-x'
import isNumber from 'is-number'
import { flatMap, isObject, fromPairs } from 'lodash'

const BASE_26 = basex('ABCDEFGHIJKLMNOPQRSTUVWXYZ')

let initialContent = window.localStorage.getItem("drawing.yml")
if (initialContent === null) {
    initialContent = "" // TODO: getting started doc
    window.localStorage.setItem("drawing.yml", "")
}

const doc = monaco.editor.createModel(initialContent, 'yaml')

monaco.editor.create(document.getElementById('editor'), {
  model: doc
})

render(initialContent)

doc.onDidChangeContent(event => {
    const snapshot = doc.createSnapshot(true)
    const text = snapshot.read()
    window.localStorage.setItem("drawing.yml", text)
    render(text)
})

function render(text) {
    try {
        const definition = yaml.load(text)
        console.log(definition)

        renderSVG(createSVG(definition), {x: 50})
    } catch (e) {
        // TODO: display on screen
        console.error(e)
    }
}

function createSVG(yaml) {
    let svg = xmlbuilder.create('svg')
    let params = {}
    svg.att('version', '1.1')
        .att('xmlns', "http://www.w3.org/2000/svg")
        .att("xmlns:parametric", "//parametric-svg.js.org/v1")
        .att("id", "rendered-svg")
        .ele('rect', { "parametric:x": "x+2", fill: "green", width: 100, height: 100 })
    
    // TODO: lint (check for name conflicts, missing types, incomplete definitions, circular references)

    let vars = yaml.vars || {}
    let elements = yaml.elements || {}
    // create vars for canvas
    
    // create vars for elements
    for (const elName of Object.keys(elements)) {
        const el = elements[elName]
        vars[elName] = {}
        switch (el.type) {
            case 'rect':
                for (const attr of ['width', 'height', 'x', 'y', 'rx', 'ry']) {
                    // copy defined attributes
                    if (attr in el) {
                        vars[elName][attr] = el[attr]
                    }
                }
                // add computed attributes
                vars[elName]['left'] = `${elName}.x`
                vars[elName]['right'] = `${elName}.x + ${elName}.width`
                vars[elName]['top'] = `${elName}.y`
                vars[elName]['bottom'] = `${elName}.y + ${elName}.y`
                break
            // case 'circle':
            //     break
            default:
                throw new Error(`Unsupported element type: ${el.type}`)
        }

    }
    // flatten vars
    vars = flattenVars(vars || {})
    // unit substitution
    // recursively replace references
    // pluck out constants to params

    return { svg: svg.end({ pretty: true }), params }
}


function flattenVars(vars) {
    const flattened = flatMap(vars, (value, key) => {
        if (isObject(value)) {
          return flatMap(value, (innerValue, innerKey) => [`${key}.${innerKey}`, innerValue])
        } else {
          return [key, value]
        }
      })
    return fromPairs(vars)
}

function sanitizeVarName(name) {
    // parametric-svg only supports camel-case with no special chars. We camel-case
    // the variable name without special characters to identify them, but to avoid conflicts
    // we also append part of the hash
    const hash = sha1(name, { outputFormat: 'buffer' })
    const suffix = BASE_26.encode(hash).substring(0, 6)
    const santized = name.replace(/[^._a-zA-Z]/, '')
    return camelCase(santized, { preserveConsecutiveUppercase: true }) + suffix
}

function renderSVG(svg, params) {
    console.log("render")
    // TODO
    document.getElementById('renderer').innerHTML = svg
    parametricSVG(document.getElementById('rendered-svg'), params)
}
