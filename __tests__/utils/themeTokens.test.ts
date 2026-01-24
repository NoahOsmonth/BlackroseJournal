const tailwindConfig = require('../../tailwind.config');

describe('theme tokens', () => {
  const colors = tailwindConfig.theme.extend.colors;
  const fonts = tailwindConfig.theme.extend.fontFamily;

  it('uses Plus Jakarta Sans as the default sans family', () => {
    expect(fonts.sans).toContain('PlusJakartaSansRegular');
  });

  it('matches updated background and surface tokens', () => {
    expect(colors['background-light']).toBe('#F2F2F7');
    expect(colors['background-dark']).toBe('#000000');
    expect(colors['surface-dark']).toBe('#1C1C1E');
  });

  it('matches updated primary and secondary tokens', () => {
    expect(colors.primary).toBe('#FF9F0A');
    expect(colors['primary-dark']).toBe('#FF8C00');
    expect(colors['text-secondary-dark']).toBe('#98989D');
  });
});
