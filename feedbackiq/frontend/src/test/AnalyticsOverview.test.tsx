import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AnalyticsOverviewView } from '../components/AnalyticsOverviewView';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    getAnalyticsReport: vi.fn(),
  },
}));

const mockReport = {
  overview: {
    total_feedback: 182,
    positive_count: 11,
    negative_count: 170,
    neutral_count: 1,
    satisfaction_percentage: 6.0,
    negative_percentage: 93.4,
    average_rating: 1.64,
    active_recurring_issues: 4,
    critical_issues: 2,
    pending_actions: 16,
    student_canteen_count: 12,
    synthetic_count: 170,
    zomato_count: 3,
  },
  sentiment_by_meal: [
    { meal_type: 'Breakfast', positive: 5, negative: 10, neutral: 0, total: 15, average_rating: 3.2 },
    { meal_type: 'Lunch', positive: 2, negative: 90, neutral: 1, total: 93, average_rating: 1.4 },
  ],
  sentiment_trend: [
    { date: '2026-10-20', positive: 1, negative: 12, neutral: 0, total: 13, average_rating: 1.5 },
  ],
  top_food_items: [
    { item: 'Rice', total_feedback: 60, complaint_count: 55, positive_count: 5, average_rating: 1.5, top_issue: 'Food Temperature' },
  ],
  top_complaints: [
    { issue: 'Rice — Food Temperature', category: 'Food Temperature', count: 55, sample_comment: 'Cold rice during lunch', severity: 4 },
  ],
  category_distribution: [
    { category: 'Food Temperature', count: 55, percentage: 30.2 },
    { category: 'Hygiene & Cleanliness', count: 40, percentage: 22.0 },
  ],
  common_topics: [
    {
      topic: 'Rice (Food Temperature)',
      item: 'Rice',
      category: 'Food Temperature',
      meal_type: 'Lunch',
      count: 55,
      average_rating: 1.5,
      sentiment_ratio: 9.1,
      sample_quotes: ['Cold rice served again during lunch.'],
    },
  ],
};

describe('AnalyticsOverviewView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders executive KPI cards and dataset discrimination banner', async () => {
    vi.mocked(api.getAnalyticsReport).mockResolvedValue(mockReport);

    render(<AnalyticsOverviewView orgId="test-org-123" />);

    await waitFor(() => {
      expect(screen.getByText('Food Feedback Analytics & Decision Intelligence')).toBeInTheDocument();
    });

    // Check KPI counts
    expect(screen.getByText('182')).toBeInTheDocument();
    expect(screen.getByText('6%')).toBeInTheDocument();
    expect(screen.getByText('93.4%')).toBeInTheDocument();

    // Check dataset discrimination
    expect(screen.getByText(/Student Canteen: 12/)).toBeInTheDocument();
    expect(screen.getByText(/Synthetic Scenarios: 170/)).toBeInTheDocument();
    expect(screen.getByText(/Kaggle Zomato: 3/)).toBeInTheDocument();
  });

  it('displays frequently reported items and common topics with quotes', async () => {
    vi.mocked(api.getAnalyticsReport).mockResolvedValue(mockReport);

    render(<AnalyticsOverviewView orgId="test-org-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Frequently Reported Food Items/)).toBeInTheDocument();
    });

    expect(screen.getByText(/1\. Rice/)).toBeInTheDocument();
    expect(screen.getByText('"Cold rice during lunch"')).toBeInTheDocument();
    expect(screen.getByText('"Cold rice served again during lunch."')).toBeInTheDocument();
  });
});
