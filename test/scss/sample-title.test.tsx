import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SampleTitle } from '@/app/_dev/scss-check/SampleTitle';

describe('SampleTitle', () => {
  it('renders with a scss-module class applied', () => {
    render(<SampleTitle />);
    const el = screen.getByText('lower third');
    expect(el.className).toBeTruthy(); // CSS-module hashed class name present
  });
});
