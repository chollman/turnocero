import { describe, it, expect } from 'vitest';
import { getActiveNavId } from './routing';

describe('getActiveNavId', () => {
  const cases = [
    ['/mi',                'feed'],
    ['/panel-admin',       'panel'],
    ['/panel-admin/users', 'panel'],
    ['/mesas/crear',       'create'],
    ['/mesas',             'dash'],
    ['/mesas/abc123',      'dash'],
    ['/noticias',          'noticias'],
    ['/noticias/abc',      'noticias'],
    ['/torneos',           'torneos'],
    ['/torneos/abc',       'torneos'],
    ['/eventos',           'eventos'],
    ['/eventos/abc',       'eventos'],
    ['/',                  'compartidas'],
    ['/compartidas',       'compartidas'],
    ['/compartidas/abc',   'compartidas'],
    ['/notificaciones',    'notif'],
    ['/mensajes-admin',    'adminChat'],
    ['/mensajes',          'mensajes'],
    ['/mensajes/abc',      'mensajes'],
    ['/bg-watch',          'bgwatchCta'],
    ['/bg-watch/user',     'bgwatch'],
    ['/usuarios',          'users'],
    ['/usuarios/abc',      'users'],
    ['/perfil',            'profile'],
    ['/base-de-datos',     'db'],
    ['/utilidades',        'utilidades'],
    ['/utilidades/dado',   'utilidades'],
    ['/something-else',    null],
  ];

  for (const [path, expected] of cases) {
    it(`returns "${expected}" for ${path}`, () => {
      expect(getActiveNavId(path)).toBe(expected);
    });
  }

  it('"mesas/crear" takes precedence over "mesas"', () => {
    expect(getActiveNavId('/mesas/crear')).toBe('create');
    expect(getActiveNavId('/mesas/other')).toBe('dash');
  });

  it('"mensajes-admin" takes precedence over "mensajes"', () => {
    expect(getActiveNavId('/mensajes-admin')).toBe('adminChat');
    expect(getActiveNavId('/mensajes/abc')).toBe('mensajes');
  });
});
