import { apiClient } from './api-client';
import { getRbacPaginated } from './rbac-pagination';

describe('getRbacPaginated', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('preserves the RBAC DataTable request envelope so list filters reach the backend', async () => {
    const post = jest.spyOn(apiClient, 'post').mockResolvedValue({
      rows: [{ userId: 7 }],
      page: { pageNum: 2, pageSize: 20, total: 21 },
    });

    const result = await getRbacPaginated<{ userId: number }>(
      '/api/rbac/v1/user/listPage',
      { page: 2, pageSize: 20, userName: 'alice' }
    );

    expect(post).toHaveBeenCalledWith(
      '/api/rbac/v1/user/listPage',
      {
        page: { pageNum: 2, pageSize: 20 },
        data: { userName: 'alice' },
      },
      undefined
    );
    expect(result.data).toEqual([{ userId: 7 }]);
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 20,
      total: 21,
      totalPages: 2,
    });
  });
});
