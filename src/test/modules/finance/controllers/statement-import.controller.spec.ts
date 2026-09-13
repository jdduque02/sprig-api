import { StatementImportController } from '@finance/controller/statement-import.controller';
import { StatementImportService } from '@finance/service/statement-import.service';

const mockService = {
  createJob: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  retryJob: jest.fn(),
};

const currentUser = { userId: 10 };

describe('StatementImportController', () => {
  let controller: StatementImportController;

  beforeEach(() => {
    controller = new StatementImportController(
      mockService as unknown as StatementImportService,
    );
    jest.clearAllMocks();
  });

  it('create delega con archivos vacíos por defecto', async () => {
    const dto = { skip_duplicates: 'true' };
    mockService.createJob.mockResolvedValue({ id: 1 });
    await controller.create(10, dto, undefined, currentUser as never);
    expect(mockService.createJob).toHaveBeenCalledWith(10, [], dto);
  });

  it('create pasa los archivos recibidos', async () => {
    const files = [{ originalname: 'a.pdf' } as Express.Multer.File];
    mockService.createJob.mockResolvedValue({ id: 1 });
    await controller.create(10, {}, files, currentUser as never);
    expect(mockService.createJob).toHaveBeenCalledWith(10, files, {});
  });

  it('findAll usa paginación por defecto', async () => {
    mockService.findAll.mockResolvedValue({ data: [], total: 0 });
    await controller.findAll(10, undefined, undefined, currentUser as never);
    expect(mockService.findAll).toHaveBeenCalledWith(10, 10, 0);
  });

  it('findAll normaliza page y limit', async () => {
    mockService.findAll.mockResolvedValue({ data: [], total: 0 });
    await controller.findAll(10, '3', '25', currentUser as never);
    expect(mockService.findAll).toHaveBeenCalledWith(10, 25, 50);
  });

  it('findAll limita a 50', async () => {
    mockService.findAll.mockResolvedValue({ data: [], total: 0 });
    await controller.findAll(10, '1', '500', currentUser as never);
    expect(mockService.findAll).toHaveBeenCalledWith(10, 50, 0);
  });

  it('findOne delega', async () => {
    mockService.findOne.mockResolvedValue({ id: 4 });
    await controller.findOne(10, 4, currentUser as never);
    expect(mockService.findOne).toHaveBeenCalledWith(4, 10);
  });

  it('retry delega con password opcional', async () => {
    mockService.retryJob.mockResolvedValue({ id: 4 });
    await controller.retry(10, 4, { password: 'x' }, currentUser as never);
    expect(mockService.retryJob).toHaveBeenCalledWith(4, 10, 'x');
  });

  it('retry delega sin password', async () => {
    mockService.retryJob.mockResolvedValue({ id: 4 });
    await controller.retry(10, 4, {}, currentUser as never);
    expect(mockService.retryJob).toHaveBeenCalledWith(4, 10, undefined);
  });
});
