import React from 'react';
import { render } from '@testing-library/react-native';
import { EmotionalLandscapeChart } from '@/components/insights/EmotionalLandscapeChart';

describe('EmotionalLandscapeChart', () => {
  it('renders correctly with data', () => {
    const data = [
      { emotion: 'Happy', score: 8, emoji: '😊' },
      { emotion: 'Sad', score: 2, emoji: '😢' },
    ];

    const { getByLabelText, getByText } = render(<EmotionalLandscapeChart data={data} />);

    // Check if emojis are rendered
    expect(getByText('😊')).toBeTruthy();
    expect(getByText('😢')).toBeTruthy();

    // Check accessibility labels
    expect(getByLabelText('Happy')).toBeTruthy();
    expect(getByLabelText('Sad')).toBeTruthy();
  });

  it('renders empty state when no data', () => {
    const { getByText } = render(<EmotionalLandscapeChart data={[]} />);
    expect(getByText('No emotional data yet')).toBeTruthy();
  });
});
