// jsdom no trae algunas APIs del navegador que usan los componentes
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} }
globalThis.IntersectionObserver = globalThis.IntersectionObserver || class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } }
window.matchMedia = window.matchMedia || ((query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false } }))
Element.prototype.scrollTo = Element.prototype.scrollTo || function scrollTo() {}
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function scrollIntoView() {}

afterEach(() => cleanup())
