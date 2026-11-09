import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Navbar } from '../components/Navbar.tsx';
import type { DatabaseStats } from '../types/database.ts';

const stats: DatabaseStats = {
  totalTrucks: 0,
  availableTrucks: 0,
  onTripTrucks: 0,
  maintenanceTrucks: 0,
  totalDrivers: 0,
  availableDrivers: 0,
  totalTrips: 0,
  ongoingTrips: 0,
  completedTrips: 0,
  plannedTrips: 0,
  totalBudgetAllocated: 0,
  totalActualExpenses: 0,
  totalSparePartsCost: 0,
  budgetLessExpensesAndParts: 0,
  totalFinalizedBudgetVariance: 0,
  withinBudgetTripsCount: 0,
  overBudgetTripsCount: 0,
};

const renderNavbar = (isAdmin: boolean) => render(
  <Navbar
    activeTab={isAdmin ? 'admin' : 'dashboard'}
    setActiveTab={vi.fn()}
    stats={stats}
    onResetDb={vi.fn()}
    onOpenNewTripModal={vi.fn()}
    isAdmin={isAdmin}
  />,
);

describe('Navbar', () => {
  it('shows only Admin, Trips, and Expenses before More for administrators', () => {
    const { getAllByRole } = renderNavbar(true);
    const desktopNav = getAllByRole('navigation')[0];
    const buttons = within(desktopNav).getAllByRole('button');

    expect(buttons.slice(0, 3).map((button) => button.textContent)).toEqual([
      expect.stringContaining('Admin'),
      expect.stringContaining('Trips'),
      expect.stringContaining('Expenses & Services'),
    ]);
    expect(buttons[3]).toHaveAccessibleName('More destinations');
    expect(within(desktopNav).queryByRole('button', { name: 'Operations' })).not.toBeInTheDocument();
  });

  it('shows only Operations, Trips, and Expenses before More for dispatchers', () => {
    const { getAllByRole } = renderNavbar(false);
    const desktopNav = getAllByRole('navigation')[0];
    const buttons = within(desktopNav).getAllByRole('button');

    expect(buttons.slice(0, 3).map((button) => button.textContent)).toEqual([
      expect.stringContaining('Operations'),
      expect.stringContaining('Trips'),
      expect.stringContaining('Expenses & Services'),
    ]);
    expect(buttons[3]).toHaveAccessibleName('More destinations');
    expect(within(desktopNav).queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('shows Clients in More for dispatchers', () => {
    const { getAllByRole } = renderNavbar(false);
    const desktopNav = getAllByRole('navigation')[0];

    fireEvent.click(within(desktopNav).getByRole('button', { name: 'More destinations' }));

    expect(within(screen.getByRole('region', { name: 'More destinations' }))
      .getByRole('button', { name: 'Clients' })).toBeInTheDocument();
  });

  it('keeps the same role-specific destinations and More on the scrollable phone navigation', () => {
    const { getAllByRole } = renderNavbar(true);
    const phoneNav = getAllByRole('navigation')[2];
    const buttons = within(phoneNav).getAllByRole('button');

    expect(buttons.slice(0, 3).map((button) => button.textContent)).toEqual([
      expect.stringContaining('Admin'),
      expect.stringContaining('Trips'),
      expect.stringContaining('Expenses & Services'),
    ]);
    expect(buttons[3]).toHaveAccessibleName('More destinations');
    expect(phoneNav).toHaveClass('overflow-x-auto');
  });

  it('offers separated destination buttons and swaps a selected destination with Expenses', () => {
    const setActiveTab = vi.fn();
    const { getAllByRole } = render(
      <Navbar
        activeTab="dashboard"
        setActiveTab={setActiveTab}
        stats={stats}
        onResetDb={vi.fn()}
        onOpenNewTripModal={vi.fn()}
        isAdmin
      />,
    );

    const desktopNav = getAllByRole('navigation')[0];
    fireEvent.click(within(desktopNav).getByRole('button', { name: 'More destinations' }));
    const morePanel = within(screen.getByRole('region', { name: 'More destinations' }));
    expect(morePanel.queryByRole('searchbox')).not.toBeInTheDocument();

    const truckFleetButton = morePanel.getByRole('button', { name: /Truck Fleet/ });
    expect(truckFleetButton).toHaveClass('border');
    expect(truckFleetButton).toHaveClass('min-w-0');
    expect(truckFleetButton).toHaveAttribute('title', 'Truck Fleet');
    expect(truckFleetButton.querySelector('span')).toHaveClass('truncate');
    fireEvent.click(truckFleetButton);
    expect(setActiveTab).toHaveBeenCalledWith('trucks');
    expect(within(desktopNav).getAllByRole('button')[2]).toHaveTextContent('Truck Fleet');

    fireEvent.click(within(desktopNav).getByRole('button', { name: 'More destinations' }));
    const updatedMorePanel = within(screen.getByRole('region', { name: 'More destinations' }));
    expect(updatedMorePanel.getByRole('button', { name: /Expenses & Services/ })).toBeInTheDocument();
    fireEvent.click(updatedMorePanel.getByRole('button', { name: /Expenses & Services/ }));

    expect(within(desktopNav).getAllByRole('button')[2]).toHaveTextContent('Expenses & Services');
    fireEvent.click(within(desktopNav).getByRole('button', { name: 'More destinations' }));
    expect(within(screen.getByRole('region', { name: 'More destinations' })).getByRole('button', { name: /Truck Fleet/ })).toBeInTheDocument();
  });
});
