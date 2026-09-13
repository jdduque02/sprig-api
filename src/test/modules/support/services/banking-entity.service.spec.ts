import { Test, TestingModule } from '@nestjs/testing';
import { BankingEntityService } from '@support/service/banking-entity.service';
import { BankingEntityRepository } from '@support/repositories/banking-entity.repository';

const mockRepo = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  findActiveDetections: jest.fn(),
};

describe('BankingEntityService', () => {
  let service: BankingEntityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankingEntityService,
        { provide: BankingEntityRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<BankingEntityService>(BankingEntityService);
    jest.clearAllMocks();
  });

  it('getActiveDetections delega en el repositorio', async () => {
    const detections = [
      { code: 'nu', detect_patterns: ['Nu Placa'] },
      { code: 'bancolombia', detect_patterns: ['Nuevos movimientos entre'] },
    ];
    mockRepo.findActiveDetections.mockResolvedValue(detections);

    const result = await service.getActiveDetections();

    expect(mockRepo.findActiveDetections).toHaveBeenCalled();
    expect(result).toEqual(detections);
  });

  it('delega las operaciones CRUD al repositorio', async () => {
    const createDto = { code: 'nu', name: 'Nu', detect_patterns: ['Nu'] };
    mockRepo.create.mockResolvedValue({ id: 1, ...createDto });
    await service.create(createDto as never);
    expect(mockRepo.create).toHaveBeenCalledWith(createDto);

    await service.findAll();
    expect(mockRepo.findAll).toHaveBeenCalled();

    await service.findOne(3);
    expect(mockRepo.findById).toHaveBeenCalledWith(3);

    const updateDto = { name: 'Nu Bank' };
    mockRepo.update.mockResolvedValue({ id: 3, ...updateDto });
    await service.update(3, updateDto as never);
    expect(mockRepo.update).toHaveBeenCalledWith(3, updateDto);

    await service.remove(3);
    expect(mockRepo.softDelete).toHaveBeenCalledWith(3);
  });
});
