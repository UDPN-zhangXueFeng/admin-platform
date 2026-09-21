/**
 * CustomInformation 单测 —— 纯展示组件，无外部依赖。
 *
 * 验收：
 *   - 空 detailsInfo 返回 null（不崩溃）。
 *   - 横排模式（默认）：label 左 40% / value 右 60%。
 *   - 竖排模式（isTable）：label 上 / value 下。
 *   - showBorder 底部分隔线。
 *   - 分组标题渲染。
 */
import * as React from 'react';
import { render } from '@testing-library/react';
import { CustomInformation } from './custom-information';
import type { CustomInformationSection } from './custom-information';

describe('CustomInformation — empty / edge cases', () => {
  it('returns null for empty detailsInfo', () => {
    const { container } = render(<CustomInformation detailsInfo={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null for undefined list in section', () => {
    const details: CustomInformationSection[] = [
      { title: 'Title', list: undefined },
    ];
    const { container } = render(<CustomInformation detailsInfo={details} />);
    // title renders but no list items
    expect(container.querySelector('div')).not.toBeNull();
    expect(container.textContent).toContain('Title');
  });

  it('renders nothing when label is null/undefined', () => {
    const details: CustomInformationSection[] = [
      {
        list: [{ value: 'should not render alone' }],
      },
    ];
    const { container } = render(<CustomInformation detailsInfo={details} />);
    expect(container.textContent).not.toContain('should not render alone');
  });
});

describe('CustomInformation — horizontal layout (default)', () => {
  it('renders label 40% and value 60%', () => {
    const details: CustomInformationSection[] = [
      {
        list: [{ label: 'Chain', value: 'Ethereum' }],
      },
    ];
    const { container } = render(<CustomInformation detailsInfo={details} />);
    const labelSpan = container.querySelector('.w-\\[40\\%\\]');
    const valueDiv = container.querySelector('.w-\\[60\\%\\]');
    expect(labelSpan).not.toBeNull();
    expect(labelSpan?.textContent).toBe('Chain');
    expect(valueDiv).not.toBeNull();
    expect(valueDiv?.textContent).toBe('Ethereum');
  });

  it('renders multiple items in horizontal layout', () => {
    const details: CustomInformationSection[] = [
      {
        list: [
          { label: 'A', value: '1' },
          { label: 'B', value: '2' },
        ],
      },
    ];
    const { container } = render(<CustomInformation detailsInfo={details} />);
    const labels = container.querySelectorAll('.w-\\[40\\%\\]');
    expect(labels.length).toBe(2);
  });
});

describe('CustomInformation — vertical layout (isTable)', () => {
  it('renders label above value with flex-col', () => {
    const details: CustomInformationSection[] = [
      {
        list: [
          {
            label: 'Description',
            value: 'Long content here',
            isTable: true,
          },
        ],
      },
    ];
    const { container } = render(<CustomInformation detailsInfo={details} />);
    const flexCol = container.querySelector('.flex-col');
    expect(flexCol).not.toBeNull();
    const mb = flexCol?.querySelector('.mb-2');
    expect(mb?.textContent).toBe('Description');
  });
});

describe('CustomInformation — showBorder separator', () => {
  it('adds bottom border style when showBorder is true', () => {
    const details: CustomInformationSection[] = [
      {
        list: [
          { label: 'X', value: 'Y', showBorder: true },
        ],
      },
    ];
    const { container } = render(<CustomInformation detailsInfo={details} />);
    const rows = container.querySelectorAll('.py-3');
    let found = false;
    rows.forEach((row) => {
      if ((row as HTMLElement).style.borderBottom) {
        found = true;
      }
    });
    expect(found).toBe(true);
  });

  it('does not add border when showBorder is false/omitted', () => {
    const details: CustomInformationSection[] = [
      {
        list: [{ label: 'X', value: 'Y' }],
      },
    ];
    const { container } = render(<CustomInformation detailsInfo={details} />);
    const row = container.querySelector('.py-3');
    expect((row as HTMLElement)?.style.borderBottom).toBeFalsy();
  });
});

describe('CustomInformation — section title', () => {
  it('renders section title with bold styling', () => {
    const details: CustomInformationSection[] = [
      {
        title: 'Basic Info',
        list: [{ label: 'K', value: 'V' }],
      },
    ];
    const { container } = render(<CustomInformation detailsInfo={details} />);
    const title = container.querySelector('.font-bold');
    expect(title?.textContent).toBe('Basic Info');
  });
});

describe('CustomInformation — multiple sections', () => {
  it('renders two sections in order', () => {
    const details: CustomInformationSection[] = [
      {
        title: 'Section 1',
        list: [{ label: 'A', value: '1' }],
      },
      {
        title: 'Section 2',
        list: [{ label: 'B', value: '2' }],
      },
    ];
    const { container } = render(<CustomInformation detailsInfo={details} />);
    const titles = container.querySelectorAll('.font-bold');
    expect(titles.length).toBe(2);
    expect(titles[0].textContent).toBe('Section 1');
    expect(titles[1].textContent).toBe('Section 2');
  });
});
