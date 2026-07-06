import { useState } from 'react';
import type { FormEvent } from 'react';

interface SearchBarProps {
  onSearch: (location: string) => void;
  isLoading: boolean;
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSearch(value);
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Enter a UK postcode or place, e.g. SW1A 1AA"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Search location"
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Searching…' : 'Find free parking'}
      </button>
    </form>
  );
}
