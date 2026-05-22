import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/server'

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))

import CreateCompartidaForm from './CreateCompartidaForm'
import { useAuth } from '../../context/AuthContext'

function setup({
  user = { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } },
  myEventos = [],
} = {}) {
  useAuth.mockReturnValue({ user })
  server.use(
    http.get('/api/tables/mine', () =>
      HttpResponse.json({
        tables: [{ _id: 't1', boardGame: 'Catán', status: 'open' }],
      }),
    ),
    http.get('/api/eventos/mine', () => HttpResponse.json({ eventos: myEventos })),
  )
  return render(
    <MemoryRouter>
      <CreateCompartidaForm onCreated={vi.fn()} onCancel={vi.fn()} />
    </MemoryRouter>,
  )
}

describe('<CreateCompartidaForm>', () => {
  it('renders title + body inputs + the photo button', async () => {
    setup()
    expect(screen.getByPlaceholderText(/título/i)).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /foto/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /publicar compartida/i }),
    ).toBeInTheDocument()
  })

  it('submit button is disabled when all fields are empty', () => {
    setup()
    expect(
      screen.getByRole('button', { name: /publicar compartida/i }),
    ).toBeDisabled()
  })

  it('typing a body enables the submit button', () => {
    setup()
    fireEvent.change(
      screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i),
      {
        target: { value: 'Anoche jugamos…' },
      },
    )
    expect(
      screen.getByRole('button', { name: /publicar compartida/i }),
    ).not.toBeDisabled()
  })

  it('shows validation error when submitting completely empty (defensive)', () => {
    setup()
    // canSubmit guard prevents submission via the disabled state; force a submit anyway
    // via form submit event to exercise the inline validation branch.
    const form = screen.getByPlaceholderText(/título/i).closest('form')
    fireEvent.submit(form)
    expect(
      screen.getByText(/agreg[aá] al menos un título, texto o foto/i),
    ).toBeInTheDocument()
  })

  it('changes privacy when clicking a privacy button', () => {
    setup()
    const friendsBtn = screen.getByRole('button', { name: 'Amigos' })
    fireEvent.click(friendsBtn)
    expect(friendsBtn.className).toMatch(/active/i)
  })

  it('cancel button calls onCancel', () => {
    const onCancel = vi.fn()
    useAuth.mockReturnValue({
      user: { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } },
    })
    server.use(
      http.get('/api/tables/mine', () => HttpResponse.json({ tables: [] })),
    )
    render(
      <MemoryRouter>
        <CreateCompartidaForm onCreated={vi.fn()} onCancel={onCancel} />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('on success creates a compartida and calls onCreated', async () => {
    const onCreated = vi.fn()
    useAuth.mockReturnValue({
      user: { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } },
    })
    server.use(
      http.get('/api/tables/mine', () => HttpResponse.json({ tables: [] })),
      http.post('/api/compartidas', () =>
        HttpResponse.json({ _id: 'new', body: 'Anoche jugamos', images: [] }),
      ),
    )
    render(
      <MemoryRouter>
        <CreateCompartidaForm onCreated={onCreated} onCancel={vi.fn()} />
      </MemoryRouter>,
    )
    fireEvent.change(
      screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i),
      {
        target: { value: 'Anoche jugamos' },
      },
    )
    fireEvent.click(
      screen.getByRole('button', { name: /publicar compartida/i }),
    )

    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(onCreated.mock.calls[0][0]._id).toBe('new')
  })

  it("loads and displays the user's active tables in the select dropdown", async () => {
    setup()
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Catán' })).toBeInTheDocument()
    })
  })

  it("F1 — muestra select de eventos cuando el user tiene eventos donde participó", async () => {
    setup({
      myEventos: [
        { _id: 'ev1', title: 'Torneo Catán', eventDate: '2027-01-01' },
        { _id: 'ev2', title: 'Sábado de Eventos', eventDate: '2027-01-02' },
      ],
    })
    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Torneo Catán' }),
      ).toBeInTheDocument()
    })
    expect(
      screen.getByRole('option', { name: 'Sábado de Eventos' }),
    ).toBeInTheDocument()
  })

  it("F1 — no muestra select de eventos cuando el user no tiene (lista vacía)", async () => {
    setup({ myEventos: [] })
    await screen.findByPlaceholderText(/título/i)
    expect(
      screen.queryByLabelText(/vincular evento/i),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Catán' })).toBeInTheDocument()
  })

  it("F1 — incluye linkedEvento en el body del POST cuando se selecciona", async () => {
    const onCreated = vi.fn()
    let captured = null
    useAuth.mockReturnValue({
      user: { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } },
    })
    server.use(
      http.get('/api/tables/mine', () => HttpResponse.json({ tables: [] })),
      http.get('/api/eventos/mine', () =>
        HttpResponse.json({
          eventos: [{ _id: 'ev1', title: 'Mi evento', eventDate: '2027-01-01' }],
        }),
      ),
      http.post('/api/compartidas', async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json({ _id: 'new', body: 'x', images: [] })
      }),
    )
    render(
      <MemoryRouter>
        <CreateCompartidaForm onCreated={onCreated} onCancel={vi.fn()} />
      </MemoryRouter>,
    )
    fireEvent.change(
      screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i),
      { target: { value: 'x' } },
    )
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Mi evento' })).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/vincular evento/i), {
      target: { value: 'ev1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /publicar compartida/i }))
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(captured.linkedEvento).toBe('ev1')
  })

  it('shows an error message when POST fails', async () => {
    const onCreated = vi.fn()
    useAuth.mockReturnValue({
      user: { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } },
    })
    server.use(
      http.get('/api/tables/mine', () => HttpResponse.json({ tables: [] })),
      http.post('/api/compartidas', () =>
        HttpResponse.json(
          { message: 'Error al publicar la compartida' },
          { status: 500 },
        ),
      ),
    )
    render(
      <MemoryRouter>
        <CreateCompartidaForm onCreated={onCreated} onCancel={vi.fn()} />
      </MemoryRouter>,
    )
    fireEvent.change(
      screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i),
      {
        target: { value: 'Algo pasó' },
      },
    )
    fireEvent.click(
      screen.getByRole('button', { name: /publicar compartida/i }),
    )
    await waitFor(() =>
      expect(
        screen.getByText(/error al publicar la compartida/i),
      ).toBeInTheDocument(),
    )
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('adding a file shows the image count in the Foto button', () => {
    setup()
    const input = document.querySelector('input[type="file"]')
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(
      screen.getByRole('button', { name: /foto \(1\/3\)/i }),
    ).toBeInTheDocument()
  })

  it('clicking ✕ on a preview removes that image', () => {
    setup()
    const input = document.querySelector('input[type="file"]')
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(
      screen.getByRole('button', { name: /foto \(1\/3\)/i }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '✕' }))
    // Back to zero images — button name is just "Foto "
    expect(
      screen.queryByRole('button', { name: /foto \(1\/3\)/i }),
    ).not.toBeInTheDocument()
  })

  it('clicking the Foto button triggers the file input click', () => {
    setup()
    const fotoBtn = screen.getByRole('button', { name: /^foto\s*$/i })
    // Click the button — calls fileInputRef.current?.click() under the hood
    fireEvent.click(fotoBtn)
    // Just verify no crash; the file dialog won't open in jsdom
  })

  it('Foto button is disabled when 3 images are already selected', () => {
    setup()
    const input = document.querySelector('input[type="file"]')
    const files = [
      new File(['1'], 'p1.jpg', { type: 'image/jpeg' }),
      new File(['2'], 'p2.jpg', { type: 'image/jpeg' }),
      new File(['3'], 'p3.jpg', { type: 'image/jpeg' }),
    ]
    fireEvent.change(input, { target: { files } })
    expect(
      screen.getByRole('button', { name: /foto \(3\/3\)/i }),
    ).toBeDisabled()
  })

  it('submit enabled after adding only an image (no text)', () => {
    setup()
    const input = document.querySelector('input[type="file"]')
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(
      screen.getByRole('button', { name: /publicar compartida/i }),
    ).not.toBeDisabled()
  })

  it('changing linked table select updates the selection', async () => {
    setup()
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Catán' })).toBeInTheDocument(),
    )
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 't1' } })
    expect(select.value).toBe('t1')
  })

  it('prefilledTableId sets the initial linked table selection', async () => {
    useAuth.mockReturnValue({
      user: { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } },
    })
    server.use(
      http.get('/api/tables/mine', () =>
        HttpResponse.json({
          tables: [{ _id: 'tPRE', boardGame: 'Pandemic', status: 'open' }],
        }),
      ),
    )
    render(
      <MemoryRouter>
        <CreateCompartidaForm
          onCreated={vi.fn()}
          onCancel={vi.fn()}
          prefilledTableId='tPRE'
        />
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(
        screen.getByRole('option', { name: 'Pandemic' }),
      ).toBeInTheDocument(),
    )
    const select = screen.getByRole('combobox')
    expect(select.value).toBe('tPRE')
  })
})
