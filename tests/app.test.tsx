import React from 'react'
import { test, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import App from '../src/App'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
    ok: true,
    status: 200,
    headers: new Headers(),
    text: () => Promise.resolve(''),
    json: () => Promise.resolve({ data: [] }),
  })))
})

test('The applications renders correctly', () => {
  const { container } = render(<App />)

  expect(container.childNodes).not.toHaveLength(0)
})
